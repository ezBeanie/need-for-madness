// Moves top-level functions (with the comment lines right above them) from one module into
// another, exports those still used elsewhere, imports them back, and gives the target the
// imports it needs, resolved from the source's imports.
// usage: [AUTO_VARS=1] node tools/refactor/extract.cjs src/game.js src/ui/hud.js "Header" fn1,fn2,... [other files that may use them]
// With AUTO_VARS=1, top-level variables used only by the moved functions move along.
// Refuses when a moved function uses a top-level name of the source that does not move:
// put that into a state object first. When the target exists, its new imports are
// appended under "// TODO merge imports:" to be merged by hand (or by merge-imports.cjs).
// Note: "still used" is a plain word match, so a name in a comment counts as a use.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");
const path = require("path");

const [srcFile, targetFile, header, list, ...extra] = process.argv.slice(2);
const names = list.split(",");
const autoVars = process.env.AUTO_VARS === "1";
let src = fs.readFileSync(srcFile, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });

const imports = new Map(); // local name -> { imported, from }
const topLevel = new Set();
for (const n of ast.body) {
  if (n.type === "ImportDeclaration")
    for (const s of n.specifiers) {
      imports.set(s.local.name, {
        imported: s.type === "ImportDefaultSpecifier" ? "default" : s.imported.name,
        from: n.source.value,
      });
    }
  if (n.type === "VariableDeclaration") n.declarations.forEach((d) => topLevel.add(d.id.name));
  if (n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") topLevel.add(n.id.name);
}

if (autoVars) {
  const usedBy = new Map();
  const vars = new Set();
  for (const n of ast.body)
    if (n.type === "VariableDeclaration") n.declarations.forEach((d) => vars.add(d.id.name));
  for (const n of ast.body) {
    const owner = n.type === "FunctionDeclaration" ? n.id.name : "<top>";
    const declaredHere =
      n.type === "VariableDeclaration" ? new Set(n.declarations.map((d) => d.id.name)) : new Set();
    walk.full(n, (x) => {
      if (x.type !== "Identifier" || !vars.has(x.name)) return;
      if (owner === "<top>" && declaredHere.has(x.name)) return;
      if (!usedBy.has(x.name)) usedBy.set(x.name, new Set());
      usedBy.get(x.name).add(owner);
    });
  }
  for (const v of vars) {
    const users = usedBy.get(v);
    if (users && [...users].every((u) => names.includes(u))) names.push(v);
  }
}

const declared = (n) =>
  n.type === "FunctionDeclaration"
    ? [n.id.name]
    : n.type === "VariableDeclaration"
      ? n.declarations.map((d) => d.id.name)
      : [];
const moved = ast.body.filter((n) => declared(n).length && declared(n).every((d) => names.includes(d)));
const missing = names.filter((n) => !moved.some((m) => declared(m).includes(n)));
if (missing.length) {
  console.error("not found:", missing);
  process.exit(1);
}

const free = new Set();
for (const fn of moved) walk.full(fn, (x) => { if (x.type === "Identifier") free.add(x.name); });
const blocking = [...free].filter((n) => topLevel.has(n) && !names.includes(n) && !imports.has(n));
if (blocking.length) {
  console.error("still in source:", blocking.join(","));
  process.exit(1);
}

const ranges = moved
  .map((fn) => {
    let start = fn.start;
    const lines = src.slice(0, start).split("\n");
    lines.pop();
    while (lines.length && /^\/\//.test(lines[lines.length - 1])) start -= lines.pop().length + 1;
    let end = fn.end;
    if (src[end] === "\n") end++;
    return [start, end];
  })
  .sort((a, b) => a[0] - b[0]);
let movedText = ranges.map(([s, e]) => src.slice(s, e)).join("");
for (const [s, e] of [...ranges].reverse()) src = src.slice(0, s) + src.slice(e);

const usedIn = (text, name) => new RegExp(`(^|[^.\\w$])${name}\\b`).test(text);
const otherFiles = extra.map((f) => fs.readFileSync(f, "utf8"));
const exported = names.filter((n) => usedIn(src, n) || otherFiles.some((t) => usedIn(t, n)));
for (const n of exported)
  movedText = movedText.replace(new RegExp(`^function ${n}\\(`, "m"), `export function ${n}(`);

const rel = (from) => {
  if (!from.startsWith(".")) return from;
  const abs = path.resolve(path.dirname(srcFile), from);
  const r = path.relative(path.dirname(targetFile), abs);
  return r.startsWith(".") ? r : `./${r}`;
};
const exists = fs.existsSync(targetFile);
let target = exists ? fs.readFileSync(targetFile, "utf8") : "";
const needed = new Map();
for (const n of free)
  if (imports.has(n)) {
    const { imported, from } = imports.get(n);
    const r = rel(from);
    if (r === `./${path.basename(targetFile)}`) continue;
    if (!needed.has(r)) needed.set(r, []);
    needed.get(r).push(imported === "default" ? `default:${n}` : imported === n ? n : `${imported} as ${n}`);
  }
const importLines = [...needed]
  .sort()
  .map(([from, specs]) => {
    const def = specs.find((x) => x.startsWith("default:"));
    const named = specs.filter((x) => !x.startsWith("default:")).sort();
    if (def && !named.length) return `import ${def.slice(8)} from "${from}";`;
    return `import { ${named.join(", ")} } from "${from}";`;
  })
  .join("\n");
if (!exists) target = `// ${header.split("\n").join("\n// ")}\n\n${importLines}\n\n${movedText}`;
else target = target + "\n" + movedText + (importLines ? `\n// TODO merge imports:\n${importLines}\n` : "");
fs.writeFileSync(targetFile, target);

if (exported.length) {
  let r = path.relative(path.dirname(srcFile), targetFile);
  if (!r.startsWith(".")) r = `./${r}`;
  const line = `import { ${exported.sort().join(", ")} } from "${r}";\n`;
  const lastImport = ast.body.filter((n) => n.type === "ImportDeclaration").pop();
  const at = lastImport.end + 1;
  src = src.slice(0, at) + line + src.slice(at);
}
fs.writeFileSync(srcFile, src);
console.log("moved", names.length, "exported", exported.join(","));

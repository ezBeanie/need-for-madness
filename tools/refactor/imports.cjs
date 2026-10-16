// Tidies the imports of modules: removes specifiers that are never used, then merges named
// imports from the same module into its first import.
// usage: node tools/refactor/imports.cjs src/game.js src/ui/hud.js ...
// "Used" means any identifier of that name outside the import declarations.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const applyEdits = (src, edits) => {
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);
  return out;
};

const prune = (src) => {
  const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
  const used = new Set();
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") continue;
    walk.full(n, (x) => { if (x.type === "Identifier") used.add(x.name); });
  }
  const edits = [];
  const removed = [];
  for (const n of ast.body) {
    if (n.type !== "ImportDeclaration" || n.specifiers.length === 0) continue;
    const keep = n.specifiers.filter((s) => used.has(s.local.name));
    if (keep.length === n.specifiers.length) continue;
    n.specifiers.filter((s) => !used.has(s.local.name)).forEach((s) => removed.push(s.local.name));
    const text = (s) => src.slice(s.start, s.end);
    const def = keep.find((s) => s.type === "ImportDefaultSpecifier");
    const named = keep.filter((s) => s.type === "ImportSpecifier").map(text);
    let line = "";
    if (keep.length)
      line = `import ${[def && text(def), named.length && `{ ${named.join(", ")} }`].filter(Boolean).join(", ")} from ${src.slice(n.source.start, n.source.end)};`;
    let end = n.end;
    if (!line && src[end] === "\n") end++;
    edits.push([n.start, end, line]);
  }
  return { out: applyEdits(src, edits), removed };
};

const merge = (src) => {
  const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
  const bySource = new Map();
  for (const n of ast.body)
    if (n.type === "ImportDeclaration" && n.specifiers.length && n.specifiers.every((s) => s.type === "ImportSpecifier")) {
      if (!bySource.has(n.source.value)) bySource.set(n.source.value, []);
      bySource.get(n.source.value).push(n);
    }
  const edits = [];
  for (const [source, decls] of bySource) {
    if (decls.length < 2) continue;
    const specs = [...new Set(decls.flatMap((d) => d.specifiers.map((s) => src.slice(s.start, s.end))))].sort((a, b) =>
      a.localeCompare(b),
    );
    edits.push([decls[0].start, decls[0].end, `import { ${specs.join(", ")} } from "${source}";`]);
    for (const d of decls.slice(1)) edits.push([d.start, src[d.end] === "\n" ? d.end + 1 : d.end, ""]);
  }
  return applyEdits(src, edits);
};

for (const file of process.argv.slice(2)) {
  const { out, removed } = prune(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, merge(out));
  console.log(file, "removed", removed.join(",") || "nothing");
}

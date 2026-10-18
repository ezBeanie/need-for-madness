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
    walk.full(n, (x) => {
      if (x.type === "Identifier") used.add(x.name);
    });
  }
  const edits = [];
  const removed = [];
  for (const n of ast.body) {
    if (n.type !== "ImportDeclaration" || n.specifiers.length === 0) continue;
    const keep = n.specifiers.filter((s) => used.has(s.local.name));
    if (keep.length === n.specifiers.length) continue;
    n.specifiers
      .filter((s) => !used.has(s.local.name))
      .forEach((s) => removed.push(s.local.name));
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
    if (
      n.type === "ImportDeclaration" &&
      n.specifiers.length &&
      n.specifiers.every((s) => s.type === "ImportSpecifier")
    ) {
      if (!bySource.has(n.source.value)) bySource.set(n.source.value, []);
      bySource.get(n.source.value).push(n);
    }
  const edits = [];
  for (const [source, decls] of bySource) {
    if (decls.length < 2) continue;
    const specs = [
      ...new Set(
        decls.flatMap((d) =>
          d.specifiers.map((s) => src.slice(s.start, s.end)),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b));
    edits.push([
      decls[0].start,
      decls[0].end,
      `import { ${specs.join(", ")} } from "${source}";`,
    ]);
    for (const d of decls.slice(1))
      edits.push([d.start, src[d.end] === "\n" ? d.end + 1 : d.end, ""]);
  }
  return applyEdits(src, edits);
};

// Named imports appended by extract.cjs may import a name twice, which does not parse, and
// sit below the code: merge them as text and put them all right below the header comment.
const NAMED_IMPORT = /^import \{([^}]*)\} from "([^"]+)";\n/gm;
const mergeAsText = (src) => {
  src = src.replace(/^\/\/ TODO merge imports:\n/m, "");
  const matches = [...src.matchAll(NAMED_IMPORT)];
  const sources = matches.map((m) => m[2]);
  const header = src.match(/^(?:\/\/.*\n)*\n*/)[0];
  const atTop = matches.every((m, i) =>
    i === 0
      ? m.index === header.length
      : m.index === matches[i - 1].index + matches[i - 1][0].length,
  );
  if (!matches.length || (atTop && new Set(sources).size === sources.length))
    return src;
  const bySource = new Map();
  for (const [, names, source] of matches) {
    if (!bySource.has(source)) bySource.set(source, new Set());
    names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((n) => bySource.get(source).add(n));
  }
  const block = [...bySource]
    .map(
      ([source, names]) =>
        `import { ${[...names].sort().join(", ")} } from "${source}";\n`,
    )
    .join("");
  const rest = src
    .replace(NAMED_IMPORT, "")
    .slice(header.length)
    .replace(/^\n+/, "");
  return (
    (header && !header.endsWith("\n\n") ? header + "\n" : header) +
    block +
    "\n" +
    rest
  );
};

for (const file of process.argv.slice(2)) {
  const { out, removed } = prune(mergeAsText(fs.readFileSync(file, "utf8")));
  fs.writeFileSync(file, merge(out));
  console.log(file, "removed", removed.join(",") || "nothing");
}

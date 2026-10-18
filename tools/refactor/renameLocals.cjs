// Renames local variables and parameters inside one top-level function.
// usage: node tools/refactor/renameLocals.cjs file functionName '{"crxz":"heading", ...}'
// Refuses when a new name is already used in the function.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const [file, fnName, mapJson] = process.argv.slice(2);
const map = JSON.parse(mapJson);
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
const fn = ast.body
  .map((n) =>
    n.type === "ExportNamedDeclaration" && n.declaration ? n.declaration : n,
  )
  .map((n) =>
    n.type === "FunctionDeclaration" && n.id.name === fnName
      ? n
      : n.type === "VariableDeclaration" && n.declarations[0].id.name === fnName
        ? n.declarations[0].init
        : null,
  )
  .find(Boolean);
if (!fn) throw new Error(`no function ${fnName}`);

const edits = [];
const used = new Set();
walk.fullAncestor(fn, (node, _, ancestors) => {
  if (node.type !== "Identifier") return;
  const parent = ancestors[ancestors.length - 2];
  if (
    parent?.type === "MemberExpression" &&
    parent.property === node &&
    !parent.computed
  )
    return;
  if (
    parent?.type === "Property" &&
    parent.key === node &&
    !parent.computed &&
    !parent.shorthand
  )
    return;
  if (node === fn.id) return;
  used.add(node.name);
  if (map[node.name]) edits.push([node.start, node.end, map[node.name]]);
});
const clashes = Object.values(map).filter((n) => used.has(n));
if (clashes.length)
  throw new Error(`already used in ${fnName}: ${clashes.join(", ")}`);
let out = src;
for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0]))
  out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(file, out);
console.log(fnName, "renamed", edits.length);

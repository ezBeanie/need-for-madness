// Scope-aware rename of module-level bindings.
// usage: node tools/refactor/rename.cjs src/game.js '{"mw":"view.scaleX", ...}'
// Renames every reference to the module-level binding (not locals or parameters of the
// same name, not property names) to the given expression, and removes the module-level
// declarators of renamed variables, printing their initializers so they can be moved.
// Do not rename names that appear in import specifiers; edit the import line first.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const file = process.argv[2];
const map = JSON.parse(process.argv[3]);
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });

const isFunction = (n) =>
  n.type === "FunctionDeclaration" ||
  n.type === "FunctionExpression" ||
  n.type === "ArrowFunctionExpression";

// names declared in a function's own scope (parameters, var, inner function declarations)
const declaredCache = new Map();
const declaredIn = (fn) => {
  if (declaredCache.has(fn)) return declaredCache.get(fn);
  const names = new Set();
  const addPattern = (p) => {
    if (!p) return;
    if (p.type === "Identifier") names.add(p.name);
    else if (p.type === "AssignmentPattern") addPattern(p.left);
    else if (p.type === "RestElement") addPattern(p.argument);
    else if (p.type === "ArrayPattern") p.elements.forEach(addPattern);
    else if (p.type === "ObjectPattern")
      p.properties.forEach((q) => addPattern(q.value ?? q.argument));
  };
  fn.params.forEach(addPattern);
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node !== fn.body && isFunction(node)) {
      if (node.type === "FunctionDeclaration") names.add(node.id.name);
      return;
    }
    if (node.type === "VariableDeclaration")
      node.declarations.forEach((d) => addPattern(d.id));
    if (node.type === "CatchClause") addPattern(node.param);
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(fn.body);
  declaredCache.set(fn, names);
  return names;
};

const edits = [];
const counts = {};
const problems = [];
walk.fullAncestor(ast, (node, _state, ancestors) => {
  if (node.type !== "Identifier" || !Object.hasOwn(map, node.name)) return;
  const parent = ancestors[ancestors.length - 2];
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
  if (parent.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
  if ((parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && parent.key === node) return;
  if (parent.type === "ImportSpecifier") return;
  const fns = ancestors.slice(0, -1).filter(isFunction);
  if (fns.some((fn) => declaredIn(fn).has(node.name))) return;
  if (parent.type === "VariableDeclarator" && parent.id === node && fns.length === 0) return;
  if (parent.type === "Property" && parent.shorthand) problems.push(`shorthand ${node.name} @${node.start}`);
  edits.push([node.start, node.end, map[node.name]]);
  counts[node.name] = (counts[node.name] || 0) + 1;
});

for (const stmt of ast.body) {
  if (stmt.type !== "VariableDeclaration") continue;
  const keep = stmt.declarations.filter((d) => !Object.hasOwn(map, d.id.name));
  const removed = stmt.declarations.filter((d) => Object.hasOwn(map, d.id.name));
  if (removed.length === 0) continue;
  for (const d of removed) if (d.init) console.log("removed initializer:", src.slice(d.start, d.end));
  const text = keep.length ? `var ${keep.map((d) => src.slice(d.start, d.end)).join(", ")};` : "";
  edits.push([stmt.start, stmt.end, text]);
}

if (problems.length) {
  console.error("problems:", problems);
  process.exit(1);
}
edits.sort((a, b) => b[0] - a[0]);
let out = src;
for (const [start, end, text] of edits) out = out.slice(0, start) + text + out.slice(end);
fs.writeFileSync(file, out);
console.log(counts);

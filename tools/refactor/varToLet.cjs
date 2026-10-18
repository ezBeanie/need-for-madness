// Turns `var` into `let` where that changes nothing: every use of the variable lies in the
// block (or for loop) of one of its declarations, after it, those blocks do not overlap, no
// function inside uses it (a closure in a loop would see a new binding per iteration), and
// no declaration without a start value sits in a loop.
// usage: node tools/refactor/varToLet.cjs file
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });

const isFunction = (n) =>
  n.type === "FunctionDeclaration" ||
  n.type === "FunctionExpression" ||
  n.type === "ArrowFunctionExpression";

// every identifier used as a variable, with its enclosing function
const uses = [];
walk.fullAncestor(ast, (node, _, ancestors) => {
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
  const functions = ancestors.filter(isFunction);
  uses.push({ node, fn: functions[functions.length - 1] ?? null, functions });
});

const isLoop = (n) =>
  /ForStatement|ForIn|ForOf|WhileStatement|DoWhile/.test(n.type);

// every var declaration inside a function, with the scope a let would have
const declarations = [];
walk.fullAncestor(ast, (node, _, ancestors) => {
  if (node.type !== "VariableDeclaration" || node.kind !== "var") return;
  const parent = ancestors[ancestors.length - 2];
  const functions = ancestors.filter(isFunction);
  const fn = functions[functions.length - 1];
  if (!fn) return; // module level stays
  const forInit = parent.type === "ForStatement" && parent.init === node;
  const scope = forInit
    ? parent
    : [...ancestors]
        .reverse()
        .find((a, i) => i > 0 && (a.type === "BlockStatement" || a === fn));
  const inner = ancestors.slice(ancestors.indexOf(fn) + 1, -1);
  // a var without a start value in a loop keeps its value from the iteration before
  const carriesOver =
    !forInit && inner.some(isLoop) && node.declarations.some((d) => !d.init);
  declarations.push({ node, fn, scope, carriesOver });
});

// A name's vars in one function become lets together when their scopes do not overlap and
// every use lies in one of them, after its declaration.
const edits = [];
let kept = 0;
const groups = new Map();
for (const d of declarations) {
  for (const decl of d.node.declarations) {
    if (decl.id.type !== "Identifier") continue;
    const key = `${d.fn.start}:${decl.id.name}`;
    if (!groups.has(key)) groups.set(key, { name: decl.id.name, list: [] });
    if (!groups.get(key).list.includes(d)) groups.get(key).list.push(d);
  }
}
const blocked = new Set();
for (const { name, list } of groups.values()) {
  const fn = list[0].fn;
  const ranges = list.map((d) => [d.node.start, d.scope.end]);
  const overlap = ranges.some(([s, e], i) =>
    ranges.some(([s2, e2], j) => i !== j && s < e2 && s2 < e),
  );
  const ok =
    !overlap &&
    list.every((d) => !d.carriesOver) &&
    uses
      .filter((u) => u.node.name === name && u.functions.includes(fn))
      .every(
        (u) =>
          u.fn === fn &&
          ranges.some(([s, e]) => u.node.start >= s && u.node.end <= e),
      );
  if (!ok) list.forEach((d) => blocked.add(d));
}
for (const d of declarations) {
  if (blocked.has(d)) kept++;
  else edits.push([d.node.start, d.node.start + 3, "let"]);
}
let out = src;
for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0]))
  out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(file, out);
console.log(file, "let", edits.length, "kept var", kept);

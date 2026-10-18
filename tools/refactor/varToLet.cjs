// Turns `var` into `let` where that changes nothing: every use of the variable lies in the
// block (or for loop) that declares it, after the declaration, and no function inside that
// block uses it (a closure in a loop would see a new binding per iteration).
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

const edits = [];
let kept = 0;
walk.fullAncestor(ast, (node, _, ancestors) => {
  if (node.type !== "VariableDeclaration" || node.kind !== "var") return;
  const parent = ancestors[ancestors.length - 2];
  const functions = ancestors.filter(isFunction);
  const fn = functions[functions.length - 1];
  if (!fn) return; // module level stays
  // the scope a let would have
  const scope =
    parent.type === "ForStatement" && parent.init === node
      ? parent
      : [...ancestors]
          .reverse()
          .find((a, i) => i > 0 && (a.type === "BlockStatement" || a === fn));
  const names = node.declarations.flatMap((d) =>
    d.id.type === "Identifier" ? [d.id.name] : [],
  );
  const ok = names.every((name) =>
    uses
      .filter(
        (u) =>
          u.node.name === name && (u.fn === fn || u.functions.includes(fn)),
      )
      .every(
        (u) =>
          u.node.start >= node.start && u.node.end <= scope.end && u.fn === fn,
      ),
  );
  // another var of the same name in the same function would clash with a let in an
  // enclosing or the same block
  const twin = names.some(
    (name) =>
      ancestors.length &&
      uses.some(
        (u) =>
          u.node.name === name &&
          u.fn === fn &&
          u.node.start < node.start &&
          u.node.start >= scope.start,
      ),
  );
  if (ok && !twin) {
    edits.push([node.start, node.start + 3, "let"]);
  } else {
    kept++;
  }
});
let out = src;
for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0]))
  out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(file, out);
console.log(file, "let", edits.length, "kept var", kept);

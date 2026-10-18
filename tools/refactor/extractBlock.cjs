// Moves the statements on lines start..end of a function into a new function, called in
// their place, with the function's locals they read as parameters.
// usage: node tools/refactor/extractBlock.cjs src/race/ai.js start end newName [--dry]
// When they assign one of those locals, the new function returns it and the call assigns
// it. Refuses when they assign more than one, declare a variable the rest of the function
// uses, or leave through return, break or continue.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const [file, startArg, endArg, name] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
const start = Number(startArg);
const end = Number(endArg);
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, {
  ecmaVersion: "latest",
  sourceType: "module",
  locations: true,
});

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// the top-level function around the lines
const topLevel = ast.body
  .map((n) =>
    n.type === "ExportNamedDeclaration" && n.declaration ? n.declaration : n,
  )
  .find(
    (n) =>
      n.loc.start.line <= start &&
      n.loc.end.line >= end &&
      (n.type === "FunctionDeclaration" ||
        (n.type === "VariableDeclaration" &&
          n.declarations[0].init &&
          /Function/.test(n.declarations[0].init.type))),
  );
if (!topLevel) fail("no top-level function around these lines");
const fn =
  topLevel.type === "FunctionDeclaration"
    ? topLevel
    : topLevel.declarations[0].init;

// the statement list holding exactly the lines
let statements = null;
walk.full(fn.body, (node) => {
  if (statements) return;
  const lists = [];
  if (node.type === "BlockStatement" || node.type === "Program")
    lists.push(node.body);
  if (node.type === "SwitchCase") lists.push(node.consequent);
  for (const list of lists) {
    const first = list.findIndex((s) => s.loc.start.line === start);
    const last = list.findIndex((s) => s.loc.end.line === end);
    if (first !== -1 && last !== -1 && first <= last) {
      statements = list.slice(first, last + 1);
    }
  }
});
if (!statements) fail("the lines are not whole statements of one block");
const from = statements[0].start;
const to = statements[statements.length - 1].end;
const inside = (node) => node.start >= from && node.end <= to;

const isFunction = (n) =>
  n.type === "FunctionDeclaration" ||
  n.type === "FunctionExpression" ||
  n.type === "ArrowFunctionExpression";

// names the function declares, inside the lines or outside them
const declaredOutside = new Set();
const declaredInside = new Set();
const declare = (pattern, inner) => {
  walk.full(pattern, (n) => {
    if (n.type === "Identifier")
      (inner ? declaredInside : declaredOutside).add(n.name);
  });
};
fn.params.forEach((p) => declare(p, false));
walk.ancestor(fn.body, {
  VariableDeclarator(n, _, ancestors) {
    // not those of functions nested in this one
    if (ancestors.slice(0, -1).some((a) => a !== fn && isFunction(a))) return;
    declare(n.id, inside(n));
  },
});

// identifiers used as variables (not property names), and whether a use writes first
const uses = [];
const writes = new Set();
walk.fullAncestor(fn.body, (node, _, ancestors) => {
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
  if (
    parent?.type === "VariableDeclarator" &&
    parent.id === node &&
    parent.init
  )
    writes.add(node);
  if (
    parent?.type === "AssignmentExpression" &&
    parent.left === node &&
    parent.operator === "="
  )
    writes.add(node);
  uses.push(node);
});
uses.sort((a, b) => a.start - b.start);
// a var the function declares again elsewhere is fine when the lines write it before
// reading it and the rest of the function does too after them
const ownCopy = (n) => {
  const firstInside = uses.find((u) => u.name === n && inside(u));
  const firstAfter = uses.find((u) => u.name === n && u.start >= to);
  return writes.has(firstInside) && (!firstAfter || writes.has(firstAfter));
};

const both = [...declaredInside].filter(
  (n) => declaredOutside.has(n) && !ownCopy(n),
);
if (both.length) fail(`declared inside and outside: ${both.join(", ")}`);

const params = [];
for (const use of uses) {
  if (
    inside(use) &&
    declaredOutside.has(use.name) &&
    !(declaredInside.has(use.name) && ownCopy(use.name))
  ) {
    if (!params.includes(use.name)) params.push(use.name);
  }
}
const leaking = [...declaredInside].filter(
  (n) => !ownCopy(n) && uses.some((u) => !inside(u) && u.name === n),
);
if (leaking.length) fail(`declared inside, used after: ${leaking.join(", ")}`);

const assigned = new Set();
for (const s of statements) {
  walk.full(s, (n) => {
    if (n.type === "AssignmentExpression" && n.left.type === "Identifier")
      assigned.add(n.left.name);
    if (n.type === "UpdateExpression" && n.argument.type === "Identifier")
      assigned.add(n.argument.name);
  });
}
const assignedParams = params.filter((p) => assigned.has(p));
if (assignedParams.length > 1)
  fail(`assigns the function's locals: ${assignedParams.join(", ")}`);
const returned = assignedParams[0];

// return anywhere, break or continue that would leave the lines
for (const s of statements) {
  walk.ancestor(s, {
    ReturnStatement(n, _, ancestors) {
      if (!ancestors.some((a) => isFunction(a)))
        fail("return inside the lines");
    },
    BreakStatement(n, _, ancestors) {
      const ok = ancestors.some(
        (a) =>
          /Loop|ForStatement|ForIn|ForOf|WhileStatement|DoWhile|SwitchStatement/.test(
            a.type,
          ) || isFunction(a),
      );
      if (!ok || n.label) fail("break leaves the lines");
    },
    ContinueStatement(n, _, ancestors) {
      const ok = ancestors.some(
        (a) =>
          /ForStatement|ForIn|ForOf|WhileStatement|DoWhile/.test(a.type) ||
          isFunction(a),
      );
      if (!ok || n.label) fail("continue leaves the lines");
    },
  });
}

const lineStart = src.lastIndexOf("\n", from) + 1;
const indent = src.slice(lineStart, from);
const call = `${returned ? `${returned} = ` : ""}${name}(${params.join(", ")});`;
const body =
  src.slice(lineStart, to) + (returned ? `\n${indent}return ${returned};` : "");
const fnEnd = topLevel.end;
const added = `\n\nfunction ${name}(${params.join(", ")}) {\n${body}\n}\n`;
const out =
  src.slice(0, lineStart) +
  indent +
  call +
  src.slice(to, fnEnd) +
  added +
  src.slice(fnEnd);
console.log(
  `${returned ? `${returned} = ` : ""}${name}(${params.join(", ")}) from ${statements.length} statements`,
);
if (!dry) fs.writeFileSync(file, out);

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

// identifiers used as variables (not property names), with their ancestors
const uses = [];
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
  uses.push(Object.assign(node, { ancestors: [...ancestors] }));
});
uses.sort((a, b) => a.start - b.start);

const mentions = (node, n) => {
  let found = false;
  if (node)
    walk.full(node, (x) => {
      if (x.type === "Identifier" && x.name === n) found = true;
    });
  return found;
};
// The statement a use plainly writes the variable in, unconditionally where the statement
// runs: `n = ...` or `let/var n = ...` as a statement of its own (or a for loop's start),
// the right side not reading n.
const plainWrite = (u) => {
  const a = u.ancestors;
  const parent = a[a.length - 2];
  if (
    parent?.type === "VariableDeclarator" &&
    parent.id === u &&
    parent.init &&
    !mentions(parent.init, u.name)
  ) {
    const declaration = a[a.length - 3];
    const holder = a[a.length - 4];
    if (holder?.type === "ForStatement" && holder.init === declaration)
      return holder;
    return declaration;
  }
  if (
    parent?.type === "AssignmentExpression" &&
    parent.left === u &&
    parent.operator === "=" &&
    !mentions(parent.right, u.name)
  ) {
    const statement = a[a.length - 3];
    if (statement?.type === "ExpressionStatement") return statement;
    const holder = a[a.length - 4];
    if (statement?.type === "SequenceExpression") return null;
    if (holder?.type === "ForStatement" && holder.init === parent)
      return holder;
  }
  return null;
};
// the lists of statements around the lines, innermost last
const blockList = (() => {
  let found = null;
  walk.fullAncestor(fn.body, (node, _, ancestors) => {
    if (node === statements[0])
      found = ancestors.filter((x) => x.type === "BlockStatement");
  });
  return found;
})();
const loopsAround = (() => {
  let found = [];
  walk.fullAncestor(fn.body, (node, _, ancestors) => {
    if (node === statements[0])
      found = ancestors.filter((x) =>
        /ForStatement|ForIn|ForOf|WhileStatement|DoWhile/.test(x.type),
      );
  });
  return found;
})();
// A var the lines write before reading, unconditionally, where the rest of the function
// writes it before reading after them, holds nothing the lines need or give: the new
// function can have its own.
const setsInLoop = (u, n) =>
  u.ancestors.some(
    (x) =>
      x.type === "ForStatement" &&
      x.init &&
      ((x.init.type === "VariableDeclaration" &&
        x.init.declarations.some((d) => d.id.name === n && d.init)) ||
        (x.init.type === "AssignmentExpression" && x.init.left.name === n)),
  );
// A use is covered when it cannot see a value from before `since`: it plainly writes the
// variable, or lies in a for loop setting it, or an earlier statement of one of its
// enclosing statement lists (starting after `since`) plainly writes it.
const covered = (u, n, since) => {
  if (plainWrite(u) || setsInLoop(u, n)) return true;
  return u.ancestors.some((x, i) => {
    if (x.type !== "BlockStatement") return false;
    const own = u.ancestors[i + 1];
    return x.body.some(
      (statement) =>
        statement.start >= since &&
        statement.end <= own.start &&
        uses.some(
          (w) =>
            w.name === n &&
            w.start >= statement.start &&
            w.end <= statement.end &&
            plainWrite(w) === statement,
        ),
    );
  });
};
// A var whose every use inside the lines, and after them, is covered holds nothing the
// lines need or give: the new function can have its own.
const ownCopy = (n) => {
  for (const loop of loopsAround) {
    if (
      uses.some((u) => u.name === n && u.start >= loop.start && u.start < from)
    )
      return false;
  }
  return uses
    .filter((u) => u.name === n && u.start >= from)
    .every((u) => covered(u, n, u.start < to ? from : to));
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
// a local the lines write before reading, and the rest writes before reading after
// them, becomes the new function's own
const scratch = params.filter((p) => assigned.has(p) && ownCopy(p));
for (const p of scratch) params.splice(params.indexOf(p), 1);
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
  (scratch.length ? `${indent}let ${scratch.join(", ")};\n` : "") +
  src.slice(lineStart, to) +
  (returned ? `\n${indent}return ${returned};` : "");
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

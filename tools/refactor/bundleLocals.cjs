// Bundles locals that a function shares with its helpers into one object: the locals of
// `fn` become fields of `objectName`, and in each helper the parameters of those names go,
// replaced by one `objectName` parameter at the end, as do the arguments of calls to them.
// usage: node tools/refactor/bundleLocals.cjs file fn objectName a,b,c helperA,helperB
// `let a = x;` in fn becomes `objectName.a = x;`; declare objectName in fn yourself first.
// Refuses when a helper declares one of the names or a call passes something else for it.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const [file, fnName, objectName, namesArg, helpersArg] = process.argv.slice(2);
const names = new Set(namesArg.split(","));
const helpers = (helpersArg ?? "").split(",").filter(Boolean);
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
const byName = new Map(
  ast.body
    .map((n) =>
      n.type === "ExportNamedDeclaration" && n.declaration ? n.declaration : n,
    )
    .filter((n) => n.type === "FunctionDeclaration")
    .map((f) => [f.id.name, f]),
);
for (const f of [fnName, ...helpers])
  if (!byName.has(f)) throw new Error(`no function ${f}`);

const bundled = (n) => n.type === "Identifier" && names.has(n.name);
// the positions of bundled parameters, per helper
const dropped = new Map(
  helpers.map((h) => [
    h,
    byName
      .get(h)
      .params.map((p, i) => (bundled(p) ? i : -1))
      .filter((i) => i >= 0),
  ]),
);

const edits = [];
// drops the items at the positions from a parameter or argument list, adding objectName
const shorten = (list, drop) => {
  const last = list.length - 1;
  list.forEach((item, i) => {
    if (!drop.includes(i) || i === last) return;
    edits.push([item.start, list[i + 1].start, ""]);
  });
  if (drop.includes(last)) edits.push([list[last].start, list[last].end, objectName]);
  else edits.push([list[last].end, list[last].end, `, ${objectName}`]);
};

const rewrite = (f, isOwner) => {
  if (!isOwner) shorten(f.params, dropped.get(f.id.name));
  const skip = new Set();
  walk.fullAncestor(f.body, (node, _, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (
      node.type === "VariableDeclaration" &&
      node.declarations.some((d) => bundled(d.id))
    ) {
      const name = node.declarations.find((d) => bundled(d.id)).id.name;
      if (!isOwner) throw new Error(`${f.id.name} declares ${name}`);
      if (node.declarations.length !== 1)
        throw new Error(`split the declaration of ${name}`);
      if (parent?.type === "ForStatement" && parent.init === node)
        throw new Error(`${name} is a loop variable`);
      const d = node.declarations[0];
      skip.add(d.id.start);
      edits.push(
        d.init
          ? [node.start, d.init.start, `${objectName}.${name} = `]
          : [node.start, node.end, `${objectName}.${name} = undefined;`],
      );
      return;
    }
    if (node.type === "CallExpression" && dropped.get(node.callee.name)?.length) {
      const drop = dropped.get(node.callee.name);
      const params = byName.get(node.callee.name).params;
      drop.forEach((i) => {
        const a = node.arguments[i];
        if (!a || !bundled(a) || a.name !== params[i].name)
          throw new Error(
            `call of ${node.callee.name} passes ${a ? src.slice(a.start, a.end) : "nothing"} for ${params[i].name}`,
          );
        skip.add(a.start);
      });
      shorten(node.arguments, drop);
      return;
    }
    if (!bundled(node) || skip.has(node.start)) return;
    if (
      parent?.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed
    )
      return;
    if (parent?.type === "Property" && parent.key === node && !parent.computed) {
      if (parent.shorthand) edits.push([node.end, node.end, `: ${objectName}.${node.name}`]);
      return;
    }
    edits.push([node.start, node.end, `${objectName}.${node.name}`]);
  });
  // a dropped argument is visited after its call; take its edit back
  for (let i = edits.length - 1; i >= 0; i--)
    if (skip.has(edits[i][0]) && edits[i][2] === `${objectName}.${src.slice(edits[i][0], edits[i][1])}`)
      edits.splice(i, 1);
};

rewrite(byName.get(fnName), true);
for (const h of helpers) rewrite(byName.get(h), false);

let out = src;
for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]))
  out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(file, out);
console.log(`bundled ${names.size} names with ${edits.length} edits`);

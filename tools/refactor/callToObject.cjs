// Turns positional calls into calls with one object argument.
// usage: node tools/refactor/callToObject.cjs src/game.js oldName newName key1,key2,...
// oldName(a, b) becomes newName({ key1: a, key2: b }); the function itself is not touched.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");
const [file, oldName, newName, keyList] = process.argv.slice(2);
const keys = keyList.split(",");
let src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
const calls = [];
walk.simple(ast, { CallExpression(n) { if (n.callee.type === "Identifier" && n.callee.name === oldName) calls.push(n); } });
calls.sort((a, b) => b.start - a.start);
for (const c of calls) {
  const props = c.arguments.map((a, i) => `${keys[i]}: ${src.slice(a.start, a.end)}`);
  src = src.slice(0, c.start) + `${newName}({ ${props.join(", ")} })` + src.slice(c.end);
}
fs.writeFileSync(file, src);
console.log(calls.length, "calls");

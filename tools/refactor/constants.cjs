// Replaces number literals compared with (==, !=, ===, !==) or assigned to an expression
// by named constants, e.g. game.phase == 7 -> game.phase == PHASE.race.
// usage: node tools/refactor/constants.cjs src/game.js game.phase '{"7":"race",...}' PHASE
// Refuses when it meets a number that has no name. Relational comparisons (<, >) and
// arithmetic stay as they are; look for them afterwards.
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const [file, target, mapJson, constants] = process.argv.slice(2);
const names = JSON.parse(mapJson);
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module" });
const isTarget = (n) => src.slice(n.start, n.end) === target;
const edits = [];
const unknown = new Set();
const take = (lit) => {
  if (lit.type !== "Literal" || typeof lit.value !== "number") return;
  const name = names[lit.value];
  if (!name) return unknown.add(lit.value);
  edits.push([lit.start, lit.end, `${constants}.${name}`]);
};
walk.simple(ast, {
  BinaryExpression(n) {
    if (!["==", "!=", "===", "!=="].includes(n.operator)) return;
    if (isTarget(n.left)) take(n.right);
    if (isTarget(n.right)) take(n.left);
  },
  AssignmentExpression(n) {
    if (n.operator === "=" && isTarget(n.left)) take(n.right);
  },
});
if (unknown.size) {
  console.error("no name for:", [...unknown]);
  process.exit(1);
}
edits.sort((a, b) => b[0] - a[0]);
let out = src;
for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);
fs.writeFileSync(file, out);
console.log("replaced", edits.length);

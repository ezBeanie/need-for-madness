// Lists the top-level statements of a function with their lines, to pick blocks for
// extractBlock.cjs. usage: node tools/refactor/statements.cjs file functionName [minLines]
const { parse } = require("acorn");
const fs = require("fs");
const [file, fnName, min] = process.argv.slice(2);
const s = fs.readFileSync(file, "utf8");
const a = parse(s, {
  ecmaVersion: "latest",
  sourceType: "module",
  locations: true,
});
const fn = a.body
  .map((n) => n.declaration || n)
  .find((n) => n.id && n.id.name === fnName);
for (const st of fn.body.body) {
  const l = st.loc.end.line - st.loc.start.line + 1;
  if (l >= Number(min || 1)) console.log(st.loc.start.line, st.loc.end.line, l);
}

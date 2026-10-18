// Renames fields of an object reached as `base.field` or `base[...].field` (e.g.
// ai[c].pan), and the matching keys `field:` of the factory that creates it.
// usage: node tools/refactor/renameFields.cjs file 'ai' '{"pan":"aimHeading", ...}' [factoryName]
// The factory's object literal keys are renamed only inside `const factoryName = () => ({...})`.
const fs = require("fs");

const [file, base, mapJson, factory] = process.argv.slice(2);
const map = JSON.parse(mapJson);
let src = fs.readFileSync(file, "utf8");
const names = Object.keys(map).join("|");
const access = new RegExp(
  `(\\b${base}(?:\\[[^\\]]+\\])?\\.)(${names})\\b`,
  "g",
);
let count = 0;
src = src.replace(access, (_, prefix, field) => {
  count++;
  return prefix + map[field];
});
if (factory) {
  const start = src.indexOf(`const ${factory} = () => ({`);
  const end = src.indexOf("});", start);
  if (start < 0 || end < 0) throw new Error(`factory ${factory} not found`);
  const literal = src
    .slice(start, end)
    .replace(new RegExp(`^(\\s*)(${names}):`, "gm"), (_, space, key) => {
      count++;
      return `${space}${map[key]}:`;
    });
  src = src.slice(0, start) + literal + src.slice(end);
}
fs.writeFileSync(file, src);
console.log("renamed", count);

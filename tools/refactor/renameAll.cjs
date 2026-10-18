// Renames names that are unique across the code base, as whole words, in every .js file of
// src and test (golden masters and snapshots left alone): exports, their imports and uses.
// usage: node tools/refactor/renameAll.cjs '{"loaddata":"loadAssets", ...}' [--dry]
// Plain text: check with --dry that a name is not also a word in strings or comments
// where it should stay.
const fs = require("fs");
const path = require("path");

const map = JSON.parse(process.argv[2]);
const dry = process.argv.includes("--dry");
const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name.startsWith("__") ? [] : files(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
const counts = Object.fromEntries(Object.keys(map).map((name) => [name, 0]));
for (const file of [...files("src"), ...files("test")]) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of Object.entries(map)) {
    text = text.replace(new RegExp(`\\b${from}\\b`, "g"), () => {
      counts[from]++;
      return to;
    });
  }
  if (!dry && text !== before) fs.writeFileSync(file, text);
}
console.log(counts);

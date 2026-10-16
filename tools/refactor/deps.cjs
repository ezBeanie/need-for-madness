// Which top-level names of a module the given functions use, and which other functions
// use them too: what has to move into state objects or modules before the functions can
// move out.
// usage: node tools/refactor/deps.cjs src/game.js fn1,fn2,...
const { parse } = require("acorn");
const walk = require("acorn-walk");
const fs = require("fs");

const s = fs.readFileSync(process.argv[2], "utf8");
const ast = parse(s, { ecmaVersion: "latest", sourceType: "module" });
const kind = new Map();
for (const n of ast.body) {
  if (n.type === "VariableDeclaration") n.declarations.forEach((d) => kind.set(d.id.name, "var"));
  if (n.type === "FunctionDeclaration") kind.set(n.id.name, "fn");
}
const usedBy = new Map();
const fnNodes = new Map();
for (const n of ast.body)
  if (n.type === "FunctionDeclaration") {
    fnNodes.set(n.id.name, n);
    const used = new Set();
    walk.full(n.body, (x) => { if (x.type === "Identifier" && kind.has(x.name)) used.add(x.name); });
    for (const u of used) {
      if (!usedBy.has(u)) usedBy.set(u, new Set());
      usedBy.get(u).add(n.id.name);
    }
  }
const targets = process.argv[3].split(",");
const deps = new Set();
for (const t of targets)
  walk.full(fnNodes.get(t).body, (x) => {
    if (x.type === "Identifier" && kind.has(x.name) && !targets.includes(x.name)) deps.add(x.name);
  });
for (const k of ["var", "fn"]) {
  console.log(`--- ${k}`);
  for (const d of [...deps].filter((d) => kind.get(d) === k).sort()) {
    const others = [...(usedBy.get(d) || [])].filter((f) => !targets.includes(f) && f !== d);
    console.log(d.padEnd(16), String(others.length).padStart(3), others.slice(0, 8).join(","));
  }
}

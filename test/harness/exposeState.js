import { parse } from "acorn";

const GAME_MODULE = "/src/game.js";

const topLevelNames = (source) => {
  const vars = new Set();
  const functions = new Set();
  for (const node of parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }).body) {
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((d) => vars.add(d.id.name));
    }
    if (node.type === "FunctionDeclaration") {
      functions.add(node.id.name);
    }
  }
  return { vars, functions };
};

// Test-only Vite plugin: the game keeps its state in module-level variables. This appends
// an export with a getter (and for variables a setter) for each of them, so tests can
// read and steer the game without the game exporting its internals.
export const exposeGameState = () => ({
  name: "expose-game-state",
  enforce: "pre",
  transform(code, id) {
    if (!id.split("?")[0].endsWith(GAME_MODULE)) {
      return null;
    }
    const { vars, functions } = topLevelNames(code);
    const accessors = [
      "get mat4() { return mat4; }",
      ...[...vars].map(
        (n) => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`,
      ),
      ...[...functions]
        .filter((n) => !vars.has(n))
        .map((n) => `get ${n}() { return ${n}; }`),
    ];
    return `${code}\nexport const __state = { ${accessors.join(",\n")} };\n`;
  },
});

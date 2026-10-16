# Refactoring tools

Small AST tools (acorn) for taking the legacy `src/game.js` apart without changing what the
game does. Run them from the repository root.

| Tool | What it does |
| --- | --- |
| `rename.cjs` | Scope-aware rename of module-level bindings to new names or expressions (`fredo` → `menu.animation`). |
| `extract.cjs` | Moves top-level functions (and, with `AUTO_VARS=1`, the variables only they use) into another module and fixes the imports. |
| `imports.cjs` | Removes unused imports and merges imports from the same module. |
| `constants.cjs` | Replaces numbers compared with or assigned to an expression by named constants. |
| `callToObject.cjs` | Turns positional calls `f(a, b)` into `g({ key1: a, key2: b })`. |
| `deps.cjs` | Lists the top-level names some functions depend on, and who else uses them. |
| `check.sh` | Prettier, ESLint, unit and golden tests, screenshot tests. |

## How a part of `game.js` moves out

1. `deps.cjs` shows what the functions share with the rest of `game.js`.
2. Shared variables become fields of state objects in their own modules (`rename.cjs`).
3. `extract.cjs` moves the functions, `imports.cjs` tidies up.
4. The moved code is rewritten readably: names, constants for number codes, smaller
   functions. Step by step it stays the original: same order of random draws, of drawing
   calls and of floating point operations.
5. `check.sh`. The golden masters compare the simulation and every 2D drawing call frame by
   frame; record new ones with the complete old `src` (`git stash -- src`) before rewriting.

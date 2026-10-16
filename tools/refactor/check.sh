#!/bin/bash
# Runs every check of the refactoring and stops at the first failure: formatting, lint,
# unit and golden tests (simulation and drawing), screenshot tests.
cd "$(dirname "$0")/../.." || exit 1
log=$(mktemp -d)
npx prettier --write src test >/dev/null || exit 1
npm run lint >"$log/lint.log" 2>&1 || { tail -20 "$log/lint.log"; exit 1; }
npx vitest run >"$log/vitest.log" 2>&1 || { grep -E "×|FAIL|Error|Tests " "$log/vitest.log" | head -20; exit 1; }
grep -E "Tests " "$log/vitest.log"
npm run test:visual >"$log/visual.log" 2>&1 || { tail -30 "$log/visual.log"; exit 1; }
grep -E "passed|failed" "$log/visual.log"

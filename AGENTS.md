# AGENTS.md

## Commands
- serve: `npm run serve` (http server)【F:package.json†L7】
- lint: `npm run lint` / `npm run lint:fix`【F:package.json†L8-L9】
- test: `npm test` (no tests configured)【F:package.json†L10】
- single test: placeholder (add test framework)

## Code Style
- Biome formatter: 2-space indent, max 80 cols, single quotes, semicolons【F:biome.json†L11-L19】
- File types: `.js`, `.html`, `.css`
- Naming: camelCase for funcs/vars, UPPER_SNAKE for constants
- Error handling: catch promises, use `console.error`, user alerts for auth/UI errors
- DOM API: direct `document.getElementById`, no frameworks

## Cursor Rules
None (`.cursor/rules/` not present)

## Copilot Rules
None (`.github/copilot-instructions.md` not present)

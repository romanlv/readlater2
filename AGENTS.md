# AGENTS.md - Coding Guidelines for ReadLater2

## Commands
- **Build**: `pnpm build` (all packages), `pnpm build:libs` (libs only)
- **Lint**: `pnpm lint` (all), `pnpm app lint` (app only), `pnpm ext lint` (extension only)
- **Test**: `pnpm test` (all), `pnpm app test` (app only), `pnpm ext test` (extension only)
- **Single Test**: `pnpm app test -- --run list.test.tsx` or `pnpm ext test -- --run popup.test.tsx`
- **TypeCheck**: `pnpm typecheck` (all), `pnpm app typecheck`, `pnpm ext typecheck`

## Code Style
- **TypeScript**: Use strict typing, interface definitions, and proper exports
- **React**: Functional components with hooks, forwardRef for UI components
- **Imports**: Use `@/` path aliases for internal imports, group by external/internal
- **Naming**: PascalCase components, camelCase variables/functions, kebab-case files
- **Formatting**: 2-space indentation, semicolons optional, double quotes for strings
- **Props**: Extend HTML element props with `React.ComponentHTMLAttributes<T>`
- **Types**: Define in separate `.ts` files, use `interface` over `type` for objects
- **Testing**: Vitest with jsdom, mock external dependencies, use Testing Library patterns
- **Errors**: Use custom Error classes, proper error boundaries, typed catch blocks

## Architecture
- **Features**: Organize by domain in `src/features/{name}/` with types, components, tests
- **Shared**: UI components in `src/components/`, core types in `packages/core/`
- **Monorepo**: Use workspace dependencies, shared packages with `@readlater/` scope
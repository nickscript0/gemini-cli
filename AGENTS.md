# Agent Guidelines for Gemini CLI

## Fork Status Tracking

**ALWAYS READ FORK_STATUS.md FIRST** when starting a new session on this repository to understand:

- What changes have already been made
- Current state of the fork
- Context for any ongoing work

**ALWAYS UPDATE FORK_STATUS.md** whenever making changes:

- Add new features to the changelog
- Update modification dates
- Document technical details
- Keep the status current

## Build/Test Commands

- `npm run build` - Build all packages
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix ESLint issues
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run all tests
- `npm run test --workspace packages/cli` - Run tests for specific package
- `npm run format` - Format code with Prettier
- `npm run preflight` - Full CI check (clean, format, lint, build, typecheck, test)

## Code Style

- **Imports**: Use ES6 imports, prefer named exports over default exports, use `node:` prefix for built-ins
- **Error Handling**: Throw `new Error()` objects, not strings or literals
- **React**: Use function components, JSX.Element return type, detect React version

## Project Structure

- Monorepo with workspaces in `packages/`
- Main CLI package in `packages/cli/`
- Tests use Vitest with jsdom environment
- Custom ESLint rule prevents relative cross-package imports

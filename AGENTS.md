# Repository Guidelines

## Project Structure & Module Organization
`OGameClone` is a Vite + React + TypeScript app. Main folders in `src/`:
- `engine/`: pure game logic (no React imports).
- `data/`: game balance definitions (buildings, ships, research, defences).
- `components/` and `panels/`: UI pieces and screen-level views.
- `context/`, `hooks/`, `models/`, `utils/`: state wiring, shared types, and helpers.
- `test/` and `__tests__/`: integration and unit/component tests.

## Build, Test, and Development Commands
Run from `OGameClone/`:
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server with HMR.
- `npm run build`: type-check and build to `dist/`.
- `npm run preview`: preview production build locally.
- `npm run lint`: run ESLint.
- `npm test`: run all Vitest tests once.
- `npm run test:watch`: run Vitest in watch mode.

## Coding Style & Naming Conventions
- TypeScript is strict; keep types explicit and avoid `any` unless justified.
- Use 2-space indentation and match surrounding style.
- Components use `PascalCase` (`ResourceBar.tsx`), hooks use `useX` (`useGameEngine.ts`), utilities use descriptive lowercase/camelCase (`format.ts`).
- Keep engine logic data-driven by editing `src/data/*` rather than hardcoding values in UI code.

## Testing Guidelines
- Framework: Vitest + Testing Library (`jsdom`).
- Naming: `*.test.ts` or `*.test.tsx`.
- Placement: colocated `__tests__/` for units/components, `src/test/integration/` for gameplay flows.
- Add or update tests when modifying formulas, queue behavior, persistence, or panel interactions.

## Commit & Pull Request Guidelines
- Use imperative commit subjects and keep each commit scoped.
- PRs should include what changed and why, commands run (`npm run lint`, `npm test`, `npm run build`), and screenshots or GIFs for UI behavior changes.

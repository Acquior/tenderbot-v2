# Repository Guidelines
 
## Project Structure & Module Organization
- Monorepo managed by Turbo + Bun.
- App: `apps/web` (Next.js, `src/app`, `src/components`, assets in `public`).
- Backend: `convex` (schema, functions, jobs). Example: `convex/documents.ts`.
- Libraries: `packages/contracts`, `packages/llm`, `packages/rag` (TypeScript libraries built to `dist/`).
 
## Build, Test, and Development Commands
- Install: `bun install`
- Dev (all workspaces): `bun run dev` (Next dev + package watchers)
- Web only: `cd apps/web && bun run dev`
- Convex dev: `npx convex dev` (or `bun x convex dev`)
- Build: `bun run build`
- Lint: `bun run lint`
- Type-check: `bun run type-check`
- Clean: `bun run clean`
 
## Coding Style & Naming Conventions
- Language: TypeScript, strict mode (`tsconfig` is strict).
- Modules: ESM in app; CommonJS in packages (output to `dist/`).
- ESLint: Next + TypeScript configs; `no-console` warns. Run `bun run lint`.
- Indentation: 2 spaces; filenames in kebab-case (e.g., `app-shell.tsx`).
- React components in PascalCase; variables in camelCase; Zod schemas in PascalCase.
 
## Testing Guidelines
- No formal test suite yet. Use `bun run type-check` and `bun run lint` as gates.
- When adding tests, prefer Vitest/Jest; name files `*.test.ts` and place near source (e.g., `packages/rag/src/chunker.test.ts`).
- Aim for meaningful unit coverage of packages and critical Convex functions.
 
## Commit & Pull Request Guidelines
- Use Conventional Commits (seen in history): `feat:`, `fix:`, `refactor:`, `docs:`.
- Example: `feat: add RAG rerank utility`
- PRs: clear description, linked issues, steps to reproduce, and screenshots for UI changes.
- Validate locally: `bun run dev`, `bun run lint`, `bun run type-check`; include notes on Convex migrations when relevant.
 
## Security & Configuration Tips
- Keep secrets in `.env.local` (web) and Convex env; never commit `.env*`.
- Client env must be prefixed `NEXT_PUBLIC_*`.
- Update Clerk/Convex config in `convex/auth.config.ts` when changing providers.

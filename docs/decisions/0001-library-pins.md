# 0001: Library pins of the platform kit

- **Status:** Proposed (implementation choices within ADR-0009 and ADR-0011; owner review pending)
- **Date:** 2026-11-23
- **Answers:** open decision 6 of the stack proposal ("library pins") for the shared packages

## Decision

| Concern | Choice | Why |
|---|---|---|
| Server framework | NestJS 12 (ESM) | ADR-0002; enforced module structure |
| OpenID Connect client | `openid-client` 6 | Certified relying-party library by the author of `jose`; PKCE, state, nonce and ID token validation built in; no custom token handling |
| Validation | `zod` 4 | One schema language for configuration, API contracts and forms; types inferred from schemas |
| Logging | `pino` 10 | Structured JSON, redaction of secrets, low overhead |
| Security headers | `helmet` 8 | Maintained defaults; the platform's Content Security Policy on top |
| Rate limiting | `@nestjs/throttler` 6 | Native to the framework; client address from Cloudflare's header |
| Data access | Prisma 7.10 (`@prisma/adapter-pg`, `@prisma/adapter-mssql`), CLI as development and migration-step dependency only | ADR-0016: one declarative model, generated migrations, driver adapters without a native runtime engine; both adapters ship with the server package and only the engine's one is loaded |
| Laboratory databases | PostgreSQL 18.6 and SQL Server 2022 CU28 images, pinned by digest | Reference and supported engines of ADR-0016; SQL Server 2022 until the organization's version is known |
| Tests | Vitest 5 (SWC for decorator metadata) | Same runner for server and browser code; fast; Vite-native |
| TypeScript | 5.9 for the packages | TypeScript 7 is used by the prototype for type checking, but NestJS needs decorator metadata emitted by the compiler; revisit when TypeScript 7 supports it |
| UI build | Babel 7 (TypeScript and React presets only), plain CSS files copied beside the JavaScript | No CSS-in-JS runtime and no build plugin in the systems (ADR-0011) |
| UI behavior | `@base-ui/react` 1.9, `@dnd-kit/core` 6.3 and `@dnd-kit/sortable` 10 | Headless, MIT, accessible; the platform owns every style (ADR-0011) |
| Package manager | pnpm 12, `minimumReleaseAge` 7 days, install scripts denied by default | Control 10: a compromised release has time to be withdrawn before it can be installed; fewer install-time attack paths |
| React | 18.3 (the UI package also accepts 19) | Systems move to 19 when the template does |

## Consequences

- Versions lag the newest release by at least a week; urgent security fixes younger than that
  are added to `minimumReleaseAgeExclude` by a reviewed pull request, with the reason.
- The visual reference of `@solidvs/ui` is the screenshot gallery in `packages/gallery`:
  `scripts/verify.sh` must stay at 0% difference, or a new baseline is approved with the change.

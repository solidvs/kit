# Instructions for AI coding agents

Every system of the organization depends on these packages. Read `README.md` first.

- **Security behavior is tested, not assumed.** Access rules, session expiry, CSRF and sign-in
  each have tests in `packages/server/src`; a change to any of them comes with its test. Run
  `pnpm test`, and `pnpm --filter @solidvs/server test:lab` when touching sign-in.
- **Department never grants a role.** Roles come from directory groups only (ADR-0009). Do not
  add a shortcut that turns a department into a privilege.
- **Tokens never reach the browser.** `GET /api/auth/me` returns only what `meResponse` builds.
- **Deny on doubt.** Missing claims, an unreachable provider or a failed refresh end the session.
- **The UI package is platform code (ADR-0011).** Systems import from `@solidvs/ui` only. Its
  runtime dependencies are Base UI, dnd-kit and the two fonts; no other UI library, no vendor names
  in code, classes or CSS variables. A visual change must keep the gallery screenshots matching
  (`packages/gallery`, `scripts/verify.sh`) or come with an approved new baseline.
- **Data layer (ADR-0016): every supported engine, or none.** A change to `src/data`, the
  provisioning procedure (`packages/server/database`) or `solidvs-data` must pass
  `test:lab:data` on PostgreSQL locally; CI runs it on SQL Server too. Never add a setting that
  skips certificate checks, a connection string key, or a way for the application login to change
  `audit_event`. A new native type in the schema translation comes with its test.
- **Service routes are for systems.** `@ServiceRoute()` never accepts a session or a person's token;
  a change to `ServiceGuard` or `JwtServiceTokenVerifier` comes with its test, unit and laboratory.
- **Definition kinds (ADR-0014).** Adding or changing a kind in `src/definitions/kinds.ts` changes
  what every system reads: keep old values valid or plan the migration, and keep secrets out
  (they belong to environment secrets, ADR-0007).
- **Styles use tokens** (`var(--ui-space-8)`, `token('text.muted')`), never raw values.
- **Dependencies:** exact versions, at least 7 days old; no install scripts unless allowed in
  `pnpm-workspace.yaml`.
- **Third-party actions are pinned by commit**, with the version in a comment.
- **Never write a secret value** to a file, a test fixture, a log line or a job summary. The lab
  generates its passwords at run time.
- **Prisma 7 for systems:** the client never imports Prisma outside a system's infrastructure
  layer; the platform kit types the client structurally (`PlatformDatabaseClient`).
- Code, comments and documentation in English; user-facing text in Portuguese.

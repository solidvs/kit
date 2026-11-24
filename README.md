# platform-kit

The two packages every system of the standard stack is built on.

| Package | What it gives a system | Decision |
|---|---|---|
| [`@solidvs/server`](packages/server) | Configuration from the platform file, sign-in through the organization's OpenID Connect provider (Keycloak federated to Active Directory), server-side sessions, the access rule, CSRF protection, roles, rate limiting, security headers, structured logs and the health endpoint, for NestJS. The data layer: Prisma on PostgreSQL or SQL Server, the insert-only audit trail, the `solidvs-data` command (schema per engine, migrations, laboratory database) and the database provisioning procedure | ADR-0009, ADR-0016 |
| [`@solidvs/ui`](packages/ui) | Platform components on Base UI and dnd-kit: tokens (light by default), fonts, icons, application shell (top nav, side nav with "Projetos"), project page and board. Fidelity checked by the screenshot gallery in [`packages/gallery`](packages/gallery) | ADR-0011 |
| [`keycloak-theme`](packages/keycloak-theme) | Login theme of the identity provider in the platform design system (tokens, text field and button of `@solidvs/ui`, Inter). System name and logo come from the client (Name, Logo URL); the password link from the realm text `platformForgotPasswordUrl`. The second-factor page carries "Confiar neste dispositivo" and the warning that IT never asks for the code. Built into `dist/platform`, mounted by the identity laboratory | ADR-0011, ADR-0018 |
| [`keycloak-extensions`](packages/keycloak-extensions) | Keycloak extensions in Java, built in a container (Docker only): the condition "second factor needed" (every sign-in, never, or only on a device not remembered, by realm policy), the step that remembers a device after the second factor, and the listener that forgets a person's devices when the password changes. A remembered device is a credential of the person, stored as a hash, rotated at each use; a reused old secret forgets every device. Built into `dist/solidvs-keycloak-extensions.jar` | ADR-0018 |

ADRs live in `solidvs/standard` (`stack/decisions/`). Library choices of this repository:
[`docs/decisions/0001-library-pins.md`](docs/decisions/0001-library-pins.md).

## Using the server package

```ts
// apps/api/src/config.ts
import { loadConfig, platformConfigSchema } from '@solidvs/server';
export const config = loadConfig(platformConfigSchema.extend({ GITHUB_APP_ID: z.string() }));

// apps/api/src/app.module.ts
@Module({
  imports: [
    PlatformModule.forRoot({
      system: 'portal',
      config,
      access: { departments: ['TI'] },                       // who enters
      roles: { admin: { groups: ['GRP-Portal-Admins'] } },   // what they may do; groups only
    }),
  ],
})
export class AppModule {}

// apps/api/src/main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
configurePlatformApp(app);
await app.listen(config.PORT);
```

Every route requires a session unless marked `@Public()`. `@RequireRoles('admin')` reserves a
route to a role. `@CurrentSession()` gives the session. `@ServiceRoute()` makes a route for other
systems instead of people: it requires a bearer access token from the client credentials grant,
issued by the organization's provider with this system's client id as audience (`client_id` equal
to `azp`), and `@CurrentService()` gives the caller's client id (ADR-0014). State-changing requests must send the
`x-csrf-token` header with the token returned by `GET /api/auth/me`.

| Route | Purpose |
|---|---|
| `GET /api/auth/login?returnTo=/path` | Sends the browser to the provider |
| `GET /api/auth/callback` | Provider's answer; creates the session only if the access rule admits the person, otherwise redirects to `/sem-acesso` |
| `GET /api/auth/me` | Who is signed in, why they may enter, roles, CSRF token (401 without session) |
| `POST /api/auth/logout` | Ends the session; returns the provider logout URL for the browser |
| `GET /api/health` | Liveness for the container healthcheck |

Configuration keys (file at `/run/secrets/config`, delivered by the platform): `PUBLIC_URL`,
`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and optionally `PORT`, `LOG_LEVEL`,
`SESSION_IDLE_MINUTES` (30), `SESSION_ABSOLUTE_HOURS` (10). The system refuses to start when a key
is missing; messages name keys, never values.

## Using the data layer

PostgreSQL is the reference engine and SQL Server a supported one; both are tested here
(ADR-0016). An installation runs one engine, chosen when the image is built
(`DATABASE_ENGINE`, `postgresql` by default).

```ts
// apps/api/src/config.ts — the database keys join the configuration file
export const configSchema = platformConfigSchema.extend(databaseConfigSchema.shape);

// apps/api/src/database.ts — the only place outside infrastructure/ that sees Prisma
import { PrismaClient } from './generated/prisma/client.js';
export const database = (config: Config) =>
  DataModule.forRoot({ config, createClient: (adapter) => new PrismaClient({ adapter }) });

// a repository in modules/<module>/infrastructure/
constructor(@Inject(DATABASE_CLIENT) private readonly db: PrismaClient) {}

// any use case that changes data
await auditTrail.record({ actor: session.user.username, action: 'order.cancelled', subjectType: 'order', subjectId: id });
```

| Piece | What it does |
|---|---|
| `DataModule.forRoot` | Prisma client over the engine's driver adapter, TLS always on with the certificate always verified (`DATABASE_TLS_CA` adds an internal authority). At start, refuses a database whose `audit_event` is not insert-only, or a login with DDL rights |
| `AuditTrail` | Writes business audit events to `audit_event` (A.8.15). Copy `AUDIT_EVENT_MODEL` into the system's schema |
| `@solidvs/server/data` | The same pieces without NestJS: `prismaCliUrl` and `loadConfig` for `prisma.config.ts` |
| `@solidvs/server/testing` | `TestDataModule` and `RecordingAuditTrail` for HTTP tests without a database |
| `solidvs-data derive [--check]` | Derives `prisma/sqlserver/schema.prisma` from the reference schema; refuses what is not engine-neutral (`Json`, `enum`, lists, strings without declared storage, unknown native types) |
| `solidvs-data migration <name>` | One migration per engine (`prisma/migrations/<engine>/`) from the change in the model, without a database; adds the audit protection to the migration that creates `audit_event`. `--check` fails when the model changed without a migration |
| `solidvs-data drift` | After `prisma migrate deploy`: fails when the database differs from the model of the build's engine |
| `solidvs-data lab up --system <id>` | A laboratory database (container, laboratory TLS, provisioned like a real one) and the configuration keys of both logins; `lab down` removes it |
| [`database/`](packages/server/database) | The provisioning procedure administrators run on the real servers: database and two logins per system and environment |

Configuration keys: `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, and
optionally `DATABASE_PORT` (5432 or 1433), `DATABASE_TLS_CA` (PEM), `DATABASE_POOL_MAX` (10).
There is no connection string and no setting that skips certificate checks.

## Administered definitions

`DEFINITION_KINDS` lists what maintainers may set in the portal without code (ADR-0014): key,
scope (`platform` or `system`), whether it is public, labels in Portuguese, and a zod schema; `null`
means "not set". The portal validates edits with `parseDefinitionValue`; systems validate what they
read with the same schema. A new kind is a reviewed change here, with its test in
`src/definitions/kinds.test.ts`.

| Key | Scope | Public | What it is |
|---|---|---|---|
| `identity.forgotPasswordUrl` | platform | yes | The "Esqueci minha senha" link of the login page (https) |

## Using the UI package

```tsx
<PlatformProvider>
  <AppShell
    userName={me.user.name}
    sideNav={
      <>
        <SideNavMenu sections={[{ id: 'main', items: [{ id: 'home', label: 'Início', href: '/', icon: HomeIcon }] }]} navigate={navigate} />
        <ProjectsMenuItem href="/projetos" recent={recentProjects} navigate={navigate} />
      </>
    }
  >
    <ProjectPage … />
  </AppShell>
</PlatformProvider>
```

The consuming Vite application needs no build plugin: the package ships plain JavaScript and CSS.
Its build must publish a `THIRD-PARTY-NOTICES` file with the licenses of the bundled packages and
fonts (ADR-0011, item 8); the system template carries it.

## Working on this repository

Node.js 24 and pnpm (version in `package.json`, through `corepack enable`).

```sh
pnpm install
pnpm typecheck && pnpm test && pnpm build
pnpm --filter @solidvs/keycloak-theme build && pnpm --filter @solidvs/keycloak-extensions build
pnpm --filter @solidvs/server test:lab   # needs Docker: Keycloak + LDAP, real sign-in; remembered devices
pnpm --filter @solidvs/server build && pnpm --filter @solidvs/server test:lab:data
                                           # needs Docker: the data layer on PostgreSQL; with
                                           # LAB_DATABASE_ENGINE=sqlserver LAB_MSSQL_ACCEPT_EULA=Y, on SQL Server
```

- **New dependency versions must be at least 7 days old** (`minimumReleaseAge` in
  `pnpm-workspace.yaml`, control 10). Pins lag a week behind the newest releases on purpose.
- **Install scripts are denied** unless allowed in `pnpm-workspace.yaml`. The Prisma CLI needs
  none: it fetches its schema engine on first use (ADR-0016).
- **Publishing:** bump both `version` fields, merge, tag `v<version>`. The `publish` workflow
  checks, builds and publishes to GitHub Packages.

## Laboratory

`lab/identity/` runs Keycloak 26.8.1 federated to an OpenLDAP directory with two people (IT and
Sales) and one group, and the database engines behind compose profiles: PostgreSQL 18
(`postgresql`) and SQL Server 2022 (`sqlserver`), both with TLS from a laboratory authority.

For local development of a system, `lab/lab.ts` runs it with generated secrets (build the server
package first):

```sh
node lab/lab.ts up                        # identity + PostgreSQL; --engine sqlserver for SQL Server
node lab/lab.ts database example dev      # database example_dev and its two logins
node lab/lab.ts config example dev --out ../system-template/config.local.json
node lab/lab.ts config example dev --migration --out ../system-template/config.migration.local.json
node lab/lab.ts password ana              # sign in as ana (TI) or bruno (Vendas), realm internal
node lab/lab.ts password carla            # sign in as carla (external), realm external
node lab/lab.ts code carla                # carla's current second-factor code
node lab/lab.ts down                      # stop and delete everything, secrets included
```

Realm `internal` (directory accounts, ADR-0009) has two clients: `portal` (http://localhost:3999)
and `example` (the system template, on http://localhost:5173). Realm `external` (local accounts with
the second factor, ADR-0018) has the client `partner-portal` (http://localhost:3998) and the person
carla, with an authenticator app whose seed the laboratory generates. Its policy lives in realm
attributes `solidvs.secondFactor.mode` and `solidvs.rememberedDevice.*`. Lab only: a code may be
used twice within its 30 seconds (`otpPolicyCodeReusable`), so the tests need not wait; real realms
keep the default (not reusable).

Keycloak's port is 8081; `LAB_KEYCLOAK_PORT` changes it when another laboratory already uses it.
The login theme and the extensions are copied into the work folder before Keycloak starts
(`lab/keycloak.ts`), because some Docker setups (Colima) share only the home folder.

**SQL Server on Apple silicon.** The image is amd64 only. Docker needs Rosetta emulation:
install Rosetta 2 (`softwareupdate --install-rosetta`), then Colima with `vmType: vz`,
`rosetta: true`, and at least 4 GB of memory (6 GB with the identity provider), or Docker Desktop
with "Use Rosetta for x86_64/amd64 emulation". Without Rosetta, Docker falls back to QEMU and
SQL Server does not start. Starting it requires `LAB_MSSQL_ACCEPT_EULA=Y`: the Developer edition
licence, for development and tests only. CI tests SQL Server natively on amd64.

### Identity `packages/server/test-lab/identity.e2e.test.ts` signs in through Keycloak's
real login form and checks: directory password accepted only by the provider; department and
groups as claims; Sales refused without a session; refresh with the provider; provider session
ended on logout; session ended at the next refresh after the person leaves IT in the directory.
Passwords and the client secret are generated for each run and deleted with the containers.

### Remembered devices `packages/server/test-lab/remembered-device.e2e.test.ts` (ADR-0018) plays
the browser against realm `external`: the code is asked on a new device and the device remembered
when the box stays ticked; a remembered device needs only the password and gets a new secret each
time; nothing is remembered with the box unticked; a copied (previous) secret forgets every device
of the person; level 2 (`acr_values=strong`) asks for the code even on a remembered device;
an administrator forgets devices, and a password reset forgets them all; at most `maxDevices` are
kept; the policy switches (`every-sign-in`, `off`, and the strictest value when unreadable).

Not covered yet: the account console does not list remembered devices (they have no credential
provider); the e-mail on a new device; reading the policy from the portal's definitions.

Not covered by the laboratory, to verify against the real Active Directory: LDAPS with the
domain's certificate, the `department` attribute and its real values, and **nested groups**
(Keycloak's group membership claim lists direct groups; nested AD groups need the LDAP group mapper
configured for AD or a group-per-role convention).

import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';

import { createDriverAdapter } from './adapter.js';
import { assertDatabaseProtection, AuditTrail, type PlatformDatabaseClient } from './audit-trail.js';
import type { DatabaseConfig } from './database-config.js';
import { databaseEngine, type DatabaseEngine } from './engine.js';

/** Injection token of the system's Prisma client. Inject it in infrastructure code only. */
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export type DataModuleOptions<C extends PlatformDatabaseClient> = {
  readonly config: DatabaseConfig;
  /** Builds the system's generated client: `(adapter) => new PrismaClient({ adapter })`. */
  readonly createClient: (adapter: SqlDriverAdapterFactory) => C;
  /** Default: `databaseEngine()`, i.e. the `DATABASE_ENGINE` the image was built for. */
  readonly engine?: DatabaseEngine;
};

class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: PlatformDatabaseClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}

/**
 * The system's database (ADR-0016): the Prisma client over an encrypted, verified connection with
 * the application login, and the audit trail. At start it connects and checks the protection of
 * the database; on any doubt the system does not start.
 */
@Module({})
export class DataModule {
  static forRoot<C extends PlatformDatabaseClient>(options: DataModuleOptions<C>): DynamicModule {
    const engine = options.engine ?? databaseEngine();
    return {
      module: DataModule,
      global: true,
      providers: [
        {
          provide: DATABASE_CLIENT,
          useFactory: async (): Promise<C> => {
            const client = options.createClient(await createDriverAdapter(engine, options.config));
            await client.$connect();
            try {
              await assertDatabaseProtection(client, engine);
            } catch (error) {
              await client.$disconnect();
              throw error;
            }
            return client;
          },
        },
        {
          provide: AuditTrail,
          inject: [DATABASE_CLIENT],
          useFactory: (client: PlatformDatabaseClient) => new AuditTrail(client),
        },
        DatabaseLifecycle,
      ],
      exports: [DATABASE_CLIENT, AuditTrail],
    };
  }
}

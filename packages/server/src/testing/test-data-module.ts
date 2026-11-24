import { Module, type DynamicModule } from '@nestjs/common';

import { AuditTrail, type AuditEvent } from '../data/audit-trail.js';
import { DATABASE_CLIENT } from '../data/data.module.js';

/** An audit trail that keeps events in memory, for HTTP tests without a database. */
export class RecordingAuditTrail extends AuditTrail {
  readonly events: AuditEvent[] = [];

  constructor() {
    super({ auditEvent: { create: async () => undefined } });
  }

  override async record(event: AuditEvent): Promise<void> {
    await super.record(event); // same validation as the real one
    this.events.push(event);
  }
}

/**
 * Replaces `DataModule` in tests that do not need a database: the audit trail records in memory
 * and there is no Prisma client, so repositories must be replaced too (`overrideProvider`).
 */
@Module({})
export class TestDataModule {
  static forRoot(auditTrail: RecordingAuditTrail = new RecordingAuditTrail()): DynamicModule {
    return {
      module: TestDataModule,
      global: true,
      providers: [
        { provide: AuditTrail, useValue: auditTrail },
        { provide: DATABASE_CLIENT, useValue: undefined },
      ],
      exports: [AuditTrail, DATABASE_CLIENT],
    };
  }
}

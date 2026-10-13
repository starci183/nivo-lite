import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AuditRow } from "./persistence/platform-audit.rows"
import { INSERT_AUDIT, LIST_RECENT_AUDITS } from "./persistence/platform-audit.sql"
import type { AuditEntry, AuditSummary } from "./platform-audit.contracts"
import { PlatformAuditLogEvent } from "./platform-audit.log-events"

@Injectable()
/** The audit trail of the platform team's console: the only writer of public.platform_audit. */
export class PlatformAuditService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes one row. It never throws: a broken audit table must not take the console down, so the failure is logged instead. */
    async record(entry: AuditEntry): Promise<void> {
        await this.entityManager
            .query(INSERT_AUDIT, [
                entry.actorEmail,
                entry.actorId,
                entry.action,
                entry.workspaceId,
                JSON.stringify(entry.data),
            ])
            .catch((cause: unknown) =>
                this.logger.error(PlatformAuditLogEvent.WriteFailed, cause, { action: entry.action }),
            )
    }

    /** The newest rows of the trail, newest first. */
    async recent(): Promise<ReadonlyArray<AuditSummary>> {
        const rows = await this.entityManager.query<Array<AuditRow>>(LIST_RECENT_AUDITS)
        return rows.map((row) => ({
            id: row.id,
            actorEmail: row.actor_email,
            action: row.action,
            workspaceId: row.workspace_id,
            createdAt: new Date(row.created_at).toISOString(),
        }))
    }
}

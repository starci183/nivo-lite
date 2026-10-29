import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PlatformAuditEntity } from "./persistence/entities"
import type { AuditEntry, AuditSummary } from "./platform-audit.contracts"
import { PlatformAuditLogEvent } from "./platform-audit.log-events"

/** How many of the newest rows the console shows. */
const RECENT_LIMIT = 15

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
            .insert(PlatformAuditEntity, {
                actorEmail: entry.actorEmail,
                actorId: entry.actorId,
                action: entry.action,
                workspaceId: entry.workspaceId,
                data: entry.data as QueryDeepPartialEntity<PlatformAuditEntity["data"]>,
            })
            .catch((cause: unknown) =>
                this.logger.error(PlatformAuditLogEvent.WriteFailed, cause, { action: entry.action }),
            )
    }

    /** The newest rows of the trail, newest first. */
    async recent(): Promise<ReadonlyArray<AuditSummary>> {
        const rows = await this.entityManager.find(PlatformAuditEntity, {
            select: { id: true, actorEmail: true, action: true, workspaceId: true, createdAt: true },
            where: { action: Not("view.health") },
            order: { createdAt: "DESC" },
            take: RECENT_LIMIT,
        })
        return rows.map((row) => ({
            id: row.id,
            actorEmail: row.actorEmail,
            action: row.action,
            workspaceId: row.workspaceId,
            createdAt: row.createdAt.toISOString(),
        }))
    }
}

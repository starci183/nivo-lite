import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    FirstEvent,
    HealthCandidate,
    HealthMark,
    IntakeConnection,
    OptionalConnectionId,
    OptionalSmtpConnection,
} from "./connections.contracts"
import { ConnectionsErrorCode } from "./errors/connections.error"
import type { HealthCandidateRow, IntakeConnectionRow, SmtpConnectionRow } from "./persistence/connections.rows"
import {
    APPLY_ZALO_AUTHORIZATION,
    FIND_INTAKE_CONNECTION,
    FIND_SMTP_CONNECTION,
    LIST_HEALTH_BATCH,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_HEALTH,
    MARK_CONNECTION_RECEIVED,
} from "./persistence/connections.sql"

/** The id every real id sorts after. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

@Injectable()
/** The status facts of a workspace's connections: the only writer of the connections table that channels need (the full capability is the connections lane's). */
export class ConnectionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The connection a delivery arrived on, or a refusal when it is missing, disconnected or of another provider. */
    async intakeOf(
        connectionId: string,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<IntakeConnection, ConnectionsErrorCode>> {
        const row = (
            await manager.query<Array<IntakeConnectionRow>>(FIND_INTAKE_CONNECTION, [connectionId, provider])
        )[0]
        if (row === undefined) return refused(ConnectionsErrorCode.NotFound)
        return ok({ id: row.id, workspaceId: row.workspace_id, status: row.status })
    }

    /** The SMTP connection to send with: the one asked for, else the workspace default, else its oldest connected one. */
    async smtpOf(workspaceId: string, connectionId: OptionalConnectionId): Promise<OptionalSmtpConnection> {
        const [row] = await this.entityManager.query<Array<SmtpConnectionRow>>(FIND_SMTP_CONNECTION, [
            workspaceId,
            connectionId,
        ])
        return row === undefined ? null : { id: row.id, meta: row.public_meta ?? {} }
    }

    /** Marks the connection as failing with the reason the owner reads on Connections. */
    async markFailing(connectionId: string, reason: string): Promise<void> {
        await this.entityManager.query(MARK_CONNECTION_ERROR, [connectionId, reason])
    }

    /** The connection received its first (or any) event: it turns connected and keeps the first event for the wizard. */
    async markReceived(connectionId: string, firstEvent: FirstEvent, manager: EntityManager): Promise<void> {
        await manager.query(MARK_CONNECTION_RECEIVED, [connectionId, JSON.stringify(firstEvent)])
    }

    /** The owner authorized the Zalo OA: its id joins the public facts and an error status clears. */
    async applyZaloAuthorization(connectionId: string, oaId?: string): Promise<void> {
        await this.entityManager.query(APPLY_ZALO_AUTHORIZATION, [
            connectionId,
            JSON.stringify(oaId === undefined ? {} : { oa_id: oaId }),
        ])
    }

    /** A page of the connections the health check judges, in id order, after the given id (empty for the first page). */
    async healthBatch(afterId: string, size: number): Promise<ReadonlyArray<HealthCandidate>> {
        const rows = await this.entityManager.query<Array<HealthCandidateRow>>(LIST_HEALTH_BATCH, [
            afterId === "" ? NIL_UUID : afterId,
            size,
        ])
        return rows.map((row) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            lastError: row.last_error,
            lastEventAt: row.last_event_at,
            createdAt: row.created_at,
            health: row.health,
        }))
    }

    /** Records the health verdict in the public facts of the connection. */
    async markHealth(connectionId: string, mark: HealthMark): Promise<void> {
        await this.entityManager.query(MARK_CONNECTION_HEALTH, [
            connectionId,
            JSON.stringify({ state: mark.state, reason: mark.reason, checked_at: mark.checkedAt }),
        ])
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { FirstEvent, IntakeConnection } from "./connections.contracts"
import { ConnectionsErrorCode } from "./errors/connections.error"
import type { IntakeConnectionRow } from "./persistence/connections.rows"
import {
    APPLY_ZALO_AUTHORIZATION,
    FIND_INTAKE_CONNECTION,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_RECEIVED,
} from "./persistence/connections.sql"

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
        const row = (await manager.query<Array<IntakeConnectionRow>>(FIND_INTAKE_CONNECTION, [connectionId, provider]))[0]
        if (row === undefined) return refused(ConnectionsErrorCode.NotFound)
        return ok({ id: row.id, workspaceId: row.workspace_id, status: row.status })
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
        await this.entityManager.query(APPLY_ZALO_AUTHORIZATION, [connectionId, JSON.stringify(oaId === undefined ? {} : { oa_id: oaId })])
    }
}

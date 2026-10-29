import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ConnectionEntity } from "./persistence/entities"

/** A connection as the console list badges read it. */
export interface ConnectionBadgeRow {
    /** The workspace. */
    readonly workspaceId: string
    /** The provider. */
    readonly provider: string
    /** The status. */
    readonly status: string
    /** The environment. */
    readonly environment: string
    /** The last event received, when any. */
    readonly lastEventAt: Date | null
    /** When it was connected. */
    readonly createdAt: Date
}

/** A connection as the console workspace detail reads it. */
export interface ConnectionAdminRow extends Omit<ConnectionBadgeRow, "workspaceId"> {
    /** The connection id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The last error, when one was recorded. */
    readonly lastError: string | null
}

@Injectable()
/** Connection reads for the platform team console. */
export class ConnectionsAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every connection that is not disconnected, at most `limit`. */
    async live(limit: number): Promise<Array<ConnectionBadgeRow>> {
        const rows = await this.entityManager.find(ConnectionEntity, {
            select: {
                workspaceId: true,
                provider: true,
                status: true,
                environment: true,
                lastEventAt: true,
                createdAt: true,
            },
            where: { status: Not("disconnected") },
            take: limit,
        })
        return rows.map(({ workspaceId, provider, status, environment, lastEventAt, createdAt }) => ({
            workspaceId,
            provider,
            status,
            environment,
            lastEventAt,
            createdAt,
        }))
    }

    /** The connections of one workspace, oldest first, at most `limit`. */
    async ofWorkspace(workspaceId: string, limit: number): Promise<Array<ConnectionAdminRow>> {
        const rows = await this.entityManager.find(ConnectionEntity, {
            select: {
                id: true,
                provider: true,
                name: true,
                status: true,
                environment: true,
                lastEventAt: true,
                lastError: true,
                createdAt: true,
            },
            where: { workspaceId },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            environment: row.environment,
            lastEventAt: row.lastEventAt,
            lastError: row.lastError,
            createdAt: row.createdAt,
        }))
    }
}

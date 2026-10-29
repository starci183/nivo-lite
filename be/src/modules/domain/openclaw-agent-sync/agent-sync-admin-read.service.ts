import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

/** The sync state of one agent as the console reads it. */
export interface AgentSyncAdminRow {
    /** The installation synced. */
    readonly installationId: string
    /** The agent on the engine. */
    readonly agentId: string
    /** The context version last synced. */
    readonly contextVersion: number | null
    /** When the sync was last checked. */
    readonly checkedAt: Date
    /** The result of the last check. */
    readonly status: string
    /** The error of the last check, when it failed. */
    readonly error: string | null
}

@Injectable()
/** Agent sync reads for the platform team console. */
export class AgentSyncAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The sync state of the agents of a workspace, at most `limit`. */
    async ofWorkspace(workspaceId: string, limit: number): Promise<Array<AgentSyncAdminRow>> {
        const rows = await this.entityManager.find(OpenclawAgentSyncEntity, {
            select: {
                installationId: true,
                agentId: true,
                contextVersion: true,
                checkedAt: true,
                status: true,
                error: true,
            },
            where: { workspaceId },
            take: limit,
        })
        return rows.map(({ installationId, agentId, contextVersion, checkedAt, status, error }) => ({
            installationId,
            agentId,
            contextVersion,
            checkedAt,
            status,
            error,
        }))
    }
}

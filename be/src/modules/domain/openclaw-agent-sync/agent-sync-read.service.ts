import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalSyncCopy } from "./openclaw-agent-sync.contracts"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the OpenClaw copy of an agent, for the capabilities that show where it stands. */
export class AgentSyncReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The copy of the agent of an installation; null when it has none yet. */
    async copyOf(installationId: string): Promise<OptionalSyncCopy> {
        const row = await this.entityManager.findOne(OpenclawAgentSyncEntity, {
            select: { status: true, contextVersion: true, checkedAt: true, error: true },
            where: { installationId },
        })
        if (row === null) return null
        return {
            status: row.status,
            contextVersion: row.contextVersion,
            checkedAt: row.checkedAt,
            error: row.error,
        }
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AiQuotaOverrideEntity } from "./persistence/entities"

/** The own credit allowance of a workspace. */
export interface QuotaOverrideRow {
    /** The monthly credits, or null when the plan's allowance applies. */
    readonly creditsLimit: string | null
}

@Injectable()
/** Allowance reads for the platform team console. */
export class AiQuotaOverridesAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The own credit allowance of a workspace; undefined when it has no override row. */
    async creditsOf(workspaceId: string): Promise<QuotaOverrideRow | undefined> {
        const row = await this.entityManager.findOne(AiQuotaOverrideEntity, {
            select: { creditsLimit: true },
            where: { workspaceId },
        })
        return row === null ? undefined : { creditsLimit: row.creditsLimit }
    }
}

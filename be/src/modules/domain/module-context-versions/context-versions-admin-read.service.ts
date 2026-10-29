import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModuleContextVersionEntity } from "./persistence/entities"

/** A context version as the console reads it. */
export interface ContextVersionAdminRow {
    /** The version row id. */
    readonly id: string
    /** The version number. */
    readonly version: number
    /** When it was applied. */
    readonly appliedAt: Date
}

@Injectable()
/** Context version reads for the platform team console. */
export class ContextVersionsAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The context versions of a workspace, at most `limit`. */
    async ofWorkspace(workspaceId: string, limit: number): Promise<Array<ContextVersionAdminRow>> {
        const rows = await this.entityManager.find(ModuleContextVersionEntity, {
            select: { id: true, version: true, appliedAt: true },
            where: { workspaceId },
            take: limit,
        })
        return rows.map(({ id, version, appliedAt }) => ({ id, version, appliedAt }))
    }
}

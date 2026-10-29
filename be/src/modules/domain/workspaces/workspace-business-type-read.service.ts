import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceEntity } from "./persistence/entities"

/** The business type of a workspace, or null when none was chosen or the workspace is unknown. */
export type OptionalBusinessType = string | null

@Injectable()
/** Reads the business type a workspace chose at onboarding, for the capabilities that tailor their advice to it. */
export class WorkspaceBusinessTypeReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The business type of the workspace, or null. */
    async businessTypeOf(workspaceId: string): Promise<OptionalBusinessType> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, businessType: true },
            where: { id: workspaceId },
        })
        return row?.businessType ?? null
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { KnowledgeSourceEntity } from "./persistence/entities"

/** The kind and stage of one document. */
export interface KnowledgeSourceStage {
    /** The kind of document. */
    readonly kind: string
    /** The stage it is in. */
    readonly status: string
}

@Injectable()
/** Document reads for the platform team console. */
export class KnowledgeSourcesAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The kind and stage of the documents of a workspace, at most `limit`. */
    async stagesOf(workspaceId: string, limit: number): Promise<Array<KnowledgeSourceStage>> {
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { kind: true, status: true },
            where: { workspaceId },
            take: limit,
        })
        return rows.map(({ kind, status }) => ({ kind, status }))
    }
}

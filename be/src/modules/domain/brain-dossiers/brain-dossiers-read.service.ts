import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DOSSIERS_MAX } from "./brain-dossiers.contracts"
import type { DossierEntry } from "./brain-dossiers.contracts"
import { BrainDossierEntity } from "./persistence/entities"

@Injectable()
/** The dossiers of a workspace for another capability working without a user (a review job): the caller has proven the workspace. */
export class BrainDossiersReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every dossier of the workspace by category and position, as the checklist stored it. */
    async all(workspaceId: string): Promise<ReadonlyArray<DossierEntry>> {
        const rows = await this.entityManager.find(BrainDossierEntity, {
            where: { workspaceId },
            order: { categoryOrder: "ASC", position: "ASC" },
            take: DOSSIERS_MAX,
        })
        return rows.map((row) => ({
            id: row.id,
            ref: row.ref,
            category: row.category,
            categoryOrder: row.categoryOrder,
            position: row.position,
            name: row.name,
            status: row.status,
            existing: row.existing,
            missing: row.missing,
            drafts: row.drafts,
        }))
    }
}

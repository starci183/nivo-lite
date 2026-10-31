import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { SourceCategoriesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectTable } from "@modules/integrations/data-sources"
import type { TableClient } from "@modules/integrations/data-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DOSSIERS_MAX } from "./brain-dossiers.contracts"
import type { DossierImportResult, DossierRecord, DossierWorkbook } from "./brain-dossiers.contracts"
import { documentCountsOf, toDossierRecord } from "./dossier-record.mapper"
import { dossiersOf, layoutOf } from "./dossier-sheet.policy"
import { BrainDossiersError, BrainDossiersErrorCode } from "./errors/brain-dossiers.error"
import { DOSSIER_CHECKLIST_WORDS } from "./messages/dossier-checklist.messages"
import { BrainDossierEntity } from "./persistence/entities"

/** Who may replace the dossiers a workspace tracks. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** The dossiers a workspace tracks in its Second Brain: listed with the documents that name them, and imported from a checklist workbook. */
export class BrainDossiersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectTable() private readonly table: TableClient,
        private readonly members: WorkspaceMembersService,
        private readonly sources: SourceCategoriesService,
    ) {}

    /** The dossiers of the workspace by category and position, each with how many documents of its category name it; any member may read them. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<DossierRecord>> {
        await this.members.require(userId, workspaceId)
        const [rows, counts] = await Promise.all([
            this.entityManager.find(BrainDossierEntity, {
                where: { workspaceId },
                order: { categoryOrder: "ASC", position: "ASC" },
                take: DOSSIERS_MAX,
            }),
            this.sources.dossierCounts(userId, workspaceId),
        ])
        const countOf = documentCountsOf(counts)
        return rows.map((row) => toDossierRecord(row, countOf(row.category, row.ref)))
    }

    /**
     * Replaces the dossiers of the workspace with those of an uploaded checklist workbook (its status tab): a dossier the workbook names
     * is added or changed by its reference, one it no longer names is removed. Only an owner or a manager may import; running it again with
     * the same workbook changes nothing.
     */
    async importChecklist(userId: string, workspaceId: string, file: DossierWorkbook): Promise<DossierImportResult> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const bytes = Buffer.from(file.contentBase64, "base64")
        const cells = await this.table.readWorkbookCells(file.name, bytes, file.sheet ?? DOSSIER_CHECKLIST_WORDS.sheet)
        const layout = layoutOf(cells)
        if (layout === null) throw new BrainDossiersError({ code: BrainDossiersErrorCode.ColumnsMissing })
        const sheet = dossiersOf(cells, layout)
        if (sheet.dossiers.length === 0) throw new BrainDossiersError({ code: BrainDossiersErrorCode.ChecklistEmpty })
        if (sheet.dossiers.length > DOSSIERS_MAX) {
            throw new BrainDossiersError({ code: BrainDossiersErrorCode.TooMany, params: { max: DOSSIERS_MAX } })
        }
        const removed = await this.entityManager.transaction(async (tx) => {
            await tx.upsert(
                BrainDossierEntity,
                sheet.dossiers.map((dossier) => ({ workspaceId, ...dossier })),
                ["workspaceId", "ref"],
            )
            const gone = await tx.delete(BrainDossierEntity, {
                workspaceId,
                ref: Not(In(sheet.dossiers.map((dossier) => dossier.ref))),
            })
            return gone.affected ?? 0
        })
        return { imported: sheet.dossiers.length, skipped: sheet.skipped, removed }
    }
}

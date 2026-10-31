import { Test } from "@nestjs/testing"
import { dossierRowOf as rowOf, DOSSIER_WORKSPACE as WS } from "@tests/fixtures/builders/brain-dossiers.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { SourceCategoriesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { TABLE } from "@modules/integrations/data-sources"
import type { TableClient } from "@modules/integrations/data-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainDossiersService } from "./brain-dossiers.service"
import { BrainDossiersErrorCode } from "./errors/brain-dossiers.error"
import { DOSSIER_CHECKLIST_WORDS } from "./messages/dossier-checklist.messages"
import { BrainDossierEntity } from "./persistence/entities"

const { columns, statuses, sheet } = DOSSIER_CHECKLIST_WORDS
const HEADER = [columns.ref, columns.category, columns.name, columns.status, columns.existing, columns.missing]
const BYTES = new Uint8Array([1, 2, 3])
const FILE = { name: "checklist.xlsx", contentBase64: Buffer.from(BYTES).toString("base64") }

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const table = mock<TableClient>()
    const sources = mock<SourceCategoriesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainDossiersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: TABLE, useValue: table },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: SourceCategoriesService, useValue: sources },
        ],
    }).compile()
    return { service: moduleRef.get(BrainDossiersService), members, table, sources }
}

describe("BrainDossiersService list", () => {
    it("lists the dossiers by category and position with the documents that name each", async () => {
        const em = mockEntityManager({
            find: [BrainDossierEntity, [rowOf(), rowOf({ id: "d2", ref: "2", position: 2, name: "Charter" })]],
        })
        const { service, members, sources } = await build(em)
        sources.dossierCounts.mockResolvedValue([{ topic: "LEGAL FILES", ref: "1", documentCount: 6 }])

        await expect(service.list("u1", WS)).resolves.toEqual([
            expect.objectContaining({ id: "d1", ref: "1", documentCount: 6 }),
            expect.objectContaining({ id: "d2", ref: "2", documentCount: 0 }),
        ])
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(sources.dossierCounts).toHaveBeenCalledWith("u1", WS)
        expect(em.find).toHaveBeenCalledWith(BrainDossierEntity, {
            where: { workspaceId: WS },
            order: { categoryOrder: "ASC", position: "ASC" },
            take: 500,
        })
    })
})

describe("BrainDossiersService importChecklist", () => {
    it("upserts the dossiers the tab names by reference, drops the others and counts what it skipped", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ upsert: [BrainDossierEntity, {}], delete: [BrainDossierEntity, { affected: 2 }] }),
        )
        const { service, members, table } = await build(tx.em)
        table.readWorkbookCells.mockResolvedValue([
            HEADER,
            ["1", "01. LEGAL FILES", "Registration certificate", statuses.present, "Certificate", ""],
            ["BKS", "05. SUPERVISORS", "Supervisory board file", statuses.missing],
        ])

        await expect(service.importChecklist("u1", WS, FILE)).resolves.toEqual({ imported: 1, skipped: 1, removed: 2 })

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(table.readWorkbookCells).toHaveBeenCalledWith(FILE.name, Buffer.from(BYTES), sheet)
        expect(tx.em.upsert).toHaveBeenCalledWith(
            BrainDossierEntity,
            [
                {
                    workspaceId: WS,
                    ref: "1",
                    category: "LEGAL FILES",
                    categoryOrder: 1,
                    position: 1,
                    name: "Registration certificate",
                    status: "present",
                    existing: "Certificate",
                    missing: null,
                    drafts: null,
                },
            ],
            ["workspaceId", "ref"],
        )
        expect(tx.em.delete).toHaveBeenCalledWith(BrainDossierEntity, { workspaceId: WS, ref: Not(In(["1"])) })
    })

    it("reads the tab the caller names and counts nothing removed when the delete answers no count", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ upsert: [BrainDossierEntity, {}], delete: [BrainDossierEntity, {}] }),
        )
        const { service, table } = await build(tx.em)
        table.readWorkbookCells.mockResolvedValue([HEADER, ["1", "01. LEGAL", "Charter", statuses.missing]])

        await expect(service.importChecklist("u1", WS, { ...FILE, sheet: "Other tab" })).resolves.toEqual({
            imported: 1,
            skipped: 0,
            removed: 0,
        })
        expect(table.readWorkbookCells).toHaveBeenCalledWith(FILE.name, Buffer.from(BYTES), "Other tab")
    })
})

describe("BrainDossiersService importChecklist refusals", () => {
    it("refuses a tab without the checklist columns and a tab without a dossier, and writes nothing", async () => {
        const em = mockEntityManager()
        const { service, table } = await build(em)
        table.readWorkbookCells.mockResolvedValueOnce([[columns.ref, columns.name]])
        await expect(service.importChecklist("u1", WS, FILE)).rejects.toMatchObject({
            code: BrainDossiersErrorCode.ColumnsMissing,
        })
        table.readWorkbookCells.mockResolvedValueOnce([HEADER, ["BKS", "05. SUPERVISORS", "File", statuses.missing]])
        await expect(service.importChecklist("u1", WS, FILE)).rejects.toMatchObject({
            code: BrainDossiersErrorCode.ChecklistEmpty,
        })
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("refuses a tab with more dossiers than a workspace may track", async () => {
        const em = mockEntityManager()
        const { service, table } = await build(em)
        const many = Array.from({ length: 501 }, (_, index) => [
            String(index + 1),
            "01. LEGAL",
            `Dossier ${index}`,
            statuses.missing,
        ])
        table.readWorkbookCells.mockResolvedValue([HEADER, ...many])

        await expect(service.importChecklist("u1", WS, FILE)).rejects.toMatchObject({
            code: BrainDossiersErrorCode.TooMany,
            params: { max: 500 },
        })
    })

    it("does not read the file for a caller who is not a manager", async () => {
        const { service, members, table } = await build(mockEntityManager())
        const refusal = new Error("role")
        members.require.mockRejectedValue(refusal)

        await expect(service.importChecklist("u1", WS, FILE)).rejects.toBe(refusal)
        expect(table.readWorkbookCells).not.toHaveBeenCalled()
    })
})

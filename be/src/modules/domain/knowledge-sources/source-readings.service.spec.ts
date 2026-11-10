import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { SourceReading } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { SourceReadingsService } from "./source-readings.service"

const WS = "11111111-1111-4111-8111-111111111111"

const READING: SourceReading = {
    reader: "pdf",
    pageCount: 3,
    sheetCount: null,
    transcribed: true,
    warnings: [{ code: "DOCUMENT_PAGE_UNREADABLE", place: "3", count: null, message: "Trang 3 khong doc duoc." }],
    refusal: null,
    reason: null,
    readAt: "2026-11-11T10:00:00.000Z",
    path: `${WS}/u/bang-gia.pdf`,
}

const rowOf = (reading: SourceReading | null): KnowledgeSourceEntity =>
    Object.assign(new KnowledgeSourceEntity(), { id: "s1", reading })

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SourceReadingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(SourceReadingsService)
}

describe("SourceReadingsService", () => {
    it("records the reading of a source of the workspace", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        await (await build(em)).record(WS, "s1", READING)
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            { id: "s1", workspaceId: WS },
            { reading: READING },
        )
    })

    it("reads the reading back checked, selecting only that column", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, rowOf(READING)] })
        await expect((await build(em)).reading(WS, "s1")).resolves.toEqual(READING)
        expect(em.findOne).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, reading: true },
            where: { id: "s1", workspaceId: WS },
        })
    })

    it("answers null for a gone source and for one never read", async () => {
        const gone = mockEntityManager({ findOne: [KnowledgeSourceEntity, null] })
        await expect((await build(gone)).reading(WS, "s1")).resolves.toBeNull()
        const unread = mockEntityManager({ findOne: [KnowledgeSourceEntity, rowOf(null)] })
        await expect((await build(unread)).reading(WS, "s1")).resolves.toBeNull()
    })
})

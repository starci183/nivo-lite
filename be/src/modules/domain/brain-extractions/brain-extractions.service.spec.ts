import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ExtractionNote } from "./brain-extractions.contracts"
import { BrainExtractionsService } from "./brain-extractions.service"
import type { BrainExtractionRow } from "./persistence/brain-extractions.rows"
import {
    FINISH_EXTRACTION,
    LIST_EXTRACTIONS,
    SAVE_PROGRESS,
    SELECT_EXTRACTION,
    UPSERT_EXTRACTION,
} from "./persistence/brain-extractions.sql"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainExtractionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainExtractionsService)
}

const row: BrainExtractionRow = {
    source_id: "s1",
    workspace_id: WS,
    status: "running",
    facts_proposed: 7,
    prompt_version: 3,
    content_hash: "hash-1",
    windows_total: 5,
    windows_done: 2,
    attempts: 1,
    orphan_fact_ids: ["f1", "f2"],
}

describe("BrainExtractionsService", () => {
    describe("states", () => {
        it("lists each document and its reading status in database order", async () => {
            const em = mockEntityManager({
                query: [
                    LIST_EXTRACTIONS,
                    [
                        { source_id: "s1", status: "running" },
                        { source_id: "s2", status: "done" },
                    ],
                ],
            })
            const service = await build(em)

            await expect(service.states(WS)).resolves.toEqual([
                { sourceId: "s1", status: "running" },
                { sourceId: "s2", status: "done" },
            ])
            expect(em.query.mock.calls).toEqual([[LIST_EXTRACTIONS, [WS]]])
        })

        it("answers an empty list for a workspace with no readings", async () => {
            const em = mockEntityManager({ query: [LIST_EXTRACTIONS, []] })
            const service = await build(em)

            await expect(service.states(WS)).resolves.toEqual([])
            expect(em.query.mock.calls).toEqual([[LIST_EXTRACTIONS, [WS]]])
        })
    })

    describe("get", () => {
        it("names every column of the stored reading and preserves its orphan facts", async () => {
            const em = mockEntityManager({ query: [SELECT_EXTRACTION, [row]] })
            const service = await build(em)

            await expect(service.get(WS, "s1")).resolves.toEqual({
                sourceId: "s1",
                status: "running",
                factsProposed: 7,
                promptVersion: 3,
                contentHash: "hash-1",
                windowsTotal: 5,
                windowsDone: 2,
                attempts: 1,
                orphanFactIds: ["f1", "f2"],
            })

            expect(em.query).toHaveBeenCalledWith(SELECT_EXTRACTION, [WS, "s1"])
        })

        it("answers an empty orphan list for a row without orphan facts", async () => {
            const service = await build(
                mockEntityManager({
                    query: [SELECT_EXTRACTION, [{ ...row, content_hash: null, orphan_fact_ids: null }]],
                }),
            )

            await expect(service.get(WS, "s1")).resolves.toEqual({
                sourceId: "s1",
                status: "running",
                factsProposed: 7,
                promptVersion: 3,
                contentHash: null,
                windowsTotal: 5,
                windowsDone: 2,
                attempts: 1,
                orphanFactIds: [],
            })
        })

        it("answers null when the document has no reading", async () => {
            const service = await build(mockEntityManager({ query: [SELECT_EXTRACTION, []] }))

            await expect(service.get(WS, "s1")).resolves.toBeNull()
        })
    })

    describe("start", () => {
        it("starts the reading with a copy of its orphan facts", async () => {
            const em = mockEntityManager({ query: [UPSERT_EXTRACTION, []] })
            const service = await build(em)
            const orphanFactIds = ["f1", "f2"]

            await expect(
                service.start({
                    workspaceId: WS,
                    sourceId: "s1",
                    promptVersion: 3,
                    contentHash: "hash-1",
                    windowsTotal: 5,
                    orphanFactIds,
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(UPSERT_EXTRACTION, [WS, "s1", 3, "hash-1", 5, ["f1", "f2"]])
            orphanFactIds.push("f3")
            expect(em.query).toHaveBeenCalledWith(UPSERT_EXTRACTION, [WS, "s1", 3, "hash-1", 5, ["f1", "f2"]])
        })
    })

    describe("save", () => {
        it("stores every progress value and the failure code", async () => {
            const em = mockEntityManager({ query: [SAVE_PROGRESS, []] })
            const service = await build(em)

            await expect(
                service.save(WS, "s1", {
                    status: "failed",
                    windowsDone: 2,
                    factsProposed: 7,
                    windowsTotal: 5,
                    error: ExtractionNote.ModelBusy,
                    attempts: 3,
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(SAVE_PROGRESS, [
                WS,
                "s1",
                "failed",
                2,
                7,
                5,
                "BRAIN_NOTE_MODEL_BUSY",
                3,
            ])
        })

        it("passes a null error for a reading that is progressing", async () => {
            const em = mockEntityManager({ query: [SAVE_PROGRESS, []] })
            const service = await build(em)

            await service.save(WS, "s1", {
                status: "running",
                windowsDone: 4,
                factsProposed: 9,
                windowsTotal: 5,
                error: null,
                attempts: 0,
            })

            expect(em.query).toHaveBeenCalledWith(SAVE_PROGRESS, [WS, "s1", "running", 4, 9, 5, null, 0])
        })
    })

    describe("finish", () => {
        it("closes the reading with the model that read it", async () => {
            const em = mockEntityManager({ query: [FINISH_EXTRACTION, []] })
            const service = await build(em)

            await expect(service.finish(WS, "s1", "model-1")).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(FINISH_EXTRACTION, [WS, "s1", "model-1"])
        })
    })
})

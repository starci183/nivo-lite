import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { ExtractionNote } from "./brain-extractions.contracts"
import { BrainExtractionsService } from "./brain-extractions.service"
import { BrainExtractionEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainExtractionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainExtractionsService)
}

const rowOf = entityRowBuilder<BrainExtractionEntity>({
    sourceId: "s1",
    workspaceId: WS,
    status: "running",
    factsProposed: 7,
    error: null,
    model: null,
    promptVersion: 3,
    contentHash: "hash-1",
    windowsTotal: 5,
    windowsDone: 2,
    attempts: 1,
    orphanFactIds: ["f1", "f2"],
    updatedAt: new Date("2026-10-13T02:00:00.000Z"),
})

/** Every update the double saw: the entity, the filter and the changes with their function expressions named. */
const updatesOf = (em: MockEntityManager): unknown => evaluatedCalls(em.update.mock.calls, 2)

describe("BrainExtractionsService", () => {
    describe("states", () => {
        it("lists each document and its reading status in database order", async () => {
            const em = mockEntityManager({
                find: [
                    BrainExtractionEntity,
                    [rowOf({ status: "running" }), rowOf({ sourceId: "s2", status: "done" })],
                ],
            })
            const service = await build(em)

            await expect(service.states(WS)).resolves.toEqual([
                { sourceId: "s1", status: "running" },
                { sourceId: "s2", status: "done" },
            ])
            expect(evaluatedCalls(em.find.mock.calls)).toEqual([
                [
                    "BrainExtractionEntity",
                    { select: { sourceId: true, status: true }, where: { workspaceId: WS }, take: 500 },
                ],
            ])
        })

        it("answers an empty list for a workspace with no readings", async () => {
            const em = mockEntityManager({ find: [BrainExtractionEntity, []] })
            const service = await build(em)

            await expect(service.states(WS)).resolves.toEqual([])
            expect(evaluatedCalls(em.find.mock.calls)).toEqual([
                [
                    "BrainExtractionEntity",
                    { select: { sourceId: true, status: true }, where: { workspaceId: WS }, take: 500 },
                ],
            ])
        })
    })
})

describe("BrainExtractionsService", () => {
    describe("get", () => {
        it("names every column of the stored reading and preserves its orphan facts", async () => {
            const em = mockEntityManager({ findOne: [BrainExtractionEntity, rowOf()] })
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

            expect(em.findOne).toHaveBeenCalledWith(BrainExtractionEntity, {
                where: { workspaceId: WS, sourceId: "s1" },
            })
        })

        it("answers an empty orphan list for a row without orphan facts", async () => {
            const service = await build(
                mockEntityManager({
                    findOne: [BrainExtractionEntity, rowOf({ contentHash: null, orphanFactIds: [] })],
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
            const service = await build(mockEntityManager({ findOne: [BrainExtractionEntity, null] }))

            await expect(service.get(WS, "s1")).resolves.toBeNull()
        })
    })
})

describe("BrainExtractionsService", () => {
    describe("start", () => {
        it("starts the reading with a copy of its orphan facts", async () => {
            const em = mockEntityManager({ upsert: [BrainExtractionEntity, {}] })
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

            const started = {
                sourceId: "s1",
                workspaceId: WS,
                status: "running",
                factsProposed: 0,
                error: null,
                model: null,
                promptVersion: 3,
                contentHash: "hash-1",
                windowsTotal: 5,
                windowsDone: 0,
                attempts: 0,
                orphanFactIds: ["f1", "f2"],
                updatedAt: "now()",
            }
            const upserts = () => evaluatedCalls(em.upsert.mock.calls, 1)
            expect(upserts()).toEqual([["BrainExtractionEntity", started, ["sourceId"]]])
            orphanFactIds.push("f3")
            expect(upserts()).toEqual([["BrainExtractionEntity", started, ["sourceId"]]])
        })
    })
})

describe("BrainExtractionsService", () => {
    describe("save", () => {
        it("stores every progress value and the failure code", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
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

            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    { workspaceId: WS, sourceId: "s1" },
                    {
                        status: "failed",
                        windowsDone: 2,
                        factsProposed: 7,
                        windowsTotal: 5,
                        error: "BRAIN_NOTE_MODEL_BUSY",
                        attempts: 3,
                        updatedAt: "now()",
                    },
                ],
            ])
        })

        it("passes a null error for a reading that is progressing", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
            const service = await build(em)

            await service.save(WS, "s1", {
                status: "running",
                windowsDone: 4,
                factsProposed: 9,
                windowsTotal: 5,
                error: null,
                attempts: 0,
            })

            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    { workspaceId: WS, sourceId: "s1" },
                    {
                        status: "running",
                        windowsDone: 4,
                        factsProposed: 9,
                        windowsTotal: 5,
                        error: null,
                        attempts: 0,
                        updatedAt: "now()",
                    },
                ],
            ])
        })
    })
})

describe("BrainExtractionsService", () => {
    describe("finish", () => {
        it("closes the reading with the model that read it", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
            const service = await build(em)

            await expect(service.finish(WS, "s1", "model-1")).resolves.toBeUndefined()

            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    { workspaceId: WS, sourceId: "s1" },
                    { status: "done", error: null, model: "model-1", orphanFactIds: [], updatedAt: "now()" },
                ],
            ])
        })
    })
})

describe("BrainExtractionsService settling", () => {
    describe("fail", () => {
        it("settles an unfinished reading as failed with the note", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
            const service = await build(em)

            await service.fail(WS, "s1", ExtractionNote.Aborted)

            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    { workspaceId: WS, sourceId: "s1", status: Not("done") },
                    { status: "failed", error: ExtractionNote.Aborted, updatedAt: "now()" },
                ],
            ])
        })
    })
})

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EXTRACTIONS_WS as WS, extractionRowOf as rowOf } from "@tests/fixtures/builders/brain-extractions.builder"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainExtractionsService } from "./brain-extractions.service"
import { BrainExtractionEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainExtractionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainExtractionsService)
}

/** Every update the double saw: the entity, the filter and the changes with their function expressions named. */
const updatesOf = (em: MockEntityManager): unknown => evaluatedCalls(em.update.mock.calls, 2)

describe("BrainExtractionsService the readings that wait", () => {
    describe("parked", () => {
        it("reads the waiting readings of every workspace, the longest-waiting first, in one bounded read", async () => {
            const em = mockEntityManager({
                find: [
                    BrainExtractionEntity,
                    [rowOf({ status: "at_ceiling" }), rowOf({ sourceId: "s2", status: "awaiting_critique" })],
                ],
            })
            const service = await build(em)

            await expect(service.parked(50)).resolves.toEqual([
                {
                    workspaceId: WS,
                    sourceId: "s1",
                    contentHash: "hash-1",
                    windowsDone: 2,
                    windowsTotal: 5,
                    status: "at_ceiling",
                },
                {
                    workspaceId: WS,
                    sourceId: "s2",
                    contentHash: "hash-1",
                    windowsDone: 2,
                    windowsTotal: 5,
                    status: "awaiting_critique",
                },
            ])
            expect(evaluatedCalls(em.find.mock.calls)).toEqual([
                [
                    "BrainExtractionEntity",
                    expect.objectContaining({
                        where: { status: In(["blocked_credits", "awaiting_critique", "at_ceiling"]) },
                        order: { updatedAt: "ASC" },
                        take: 50,
                    }),
                ],
            ])
        })
    })

    describe("resume and reopen", () => {
        it("lets a waiting reading go on only once, and opens an ended one at its settle stage", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
            const service = await build(em)

            await expect(service.resume(WS, "s1")).resolves.toBe(true)
            await expect(service.reopen(WS, "s1")).resolves.toBe(true)
            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    {
                        workspaceId: WS,
                        sourceId: "s1",
                        status: In(["blocked_credits", "awaiting_critique", "at_ceiling"]),
                    },
                    { status: "running", error: null },
                ],
                [
                    "BrainExtractionEntity",
                    {
                        workspaceId: WS,
                        sourceId: "s1",
                        status: In(["done", "awaiting_critique", "at_ceiling"]),
                        stage: "settle",
                    },
                    { status: "running", error: null },
                ],
            ])

            const none = await build(mockEntityManager({ update: [BrainExtractionEntity, { affected: 0 }] }))
            await expect(none.resume(WS, "s1")).resolves.toBe(false)
            await expect(none.reopen(WS, "s1")).resolves.toBe(false)
        })
    })

    describe("settling", () => {
        it("tells a reading in the middle of a settle (running at the settle stage) from any other: a verdict change then queues another settle", async () => {
            const em = mockEntityManager({ exists: [BrainExtractionEntity, true] })
            const service = await build(em)

            await expect(service.settling(WS, "s1")).resolves.toBe(true)
            expect(em.exists).toHaveBeenCalledWith(BrainExtractionEntity, {
                where: { workspaceId: WS, sourceId: "s1", status: "running", stage: "settle" },
            })

            const idle = await build(mockEntityManager({ exists: [BrainExtractionEntity, false] }))
            await expect(idle.settling(WS, "s1")).resolves.toBe(false)
        })
    })

    describe("ceilingSince", () => {
        it("names the episode of the ceiling: when the longest-waiting reading of the workspace stopped at it; null when none is", async () => {
            const stopped = new Date("2026-11-11T05:00:00.000Z")
            const em = mockEntityManager({
                findOne: [BrainExtractionEntity, rowOf({ status: "at_ceiling", updatedAt: stopped })],
            })
            const service = await build(em)

            await expect(service.ceilingSince(WS)).resolves.toEqual(stopped)
            expect(evaluatedCalls(em.findOne.mock.calls)).toEqual([
                [
                    "BrainExtractionEntity",
                    expect.objectContaining({
                        where: { workspaceId: WS, status: "at_ceiling" },
                        order: { updatedAt: "ASC" },
                    }),
                ],
            ])

            const none = await build(mockEntityManager({ findOne: [BrainExtractionEntity, null] }))
            await expect(none.ceilingSince(WS)).resolves.toBeNull()
        })
    })
})

describe("BrainExtractionsService the stage and the page of a reading", () => {
    describe("save", () => {
        it("saves the stage and only the counts a save names", async () => {
            const em = mockEntityManager({ update: [BrainExtractionEntity, { affected: 1 }] })
            const service = await build(em)

            await service.save(WS, "s1", {
                status: "at_ceiling",
                windowsDone: 3,
                factsProposed: 9,
                windowsTotal: 3,
                error: "BRAIN_NOTE_TRUTH_CEILING",
                attempts: 0,
                stage: "settle",
                counts: { factsApplied: 4, factsWaiting: 5 },
            })

            expect(updatesOf(em)).toEqual([
                [
                    "BrainExtractionEntity",
                    { workspaceId: WS, sourceId: "s1" },
                    {
                        status: "at_ceiling",
                        windowsDone: 3,
                        factsProposed: 9,
                        windowsTotal: 3,
                        error: "BRAIN_NOTE_TRUTH_CEILING",
                        attempts: 0,
                        stage: "settle",
                        factsApplied: 4,
                        factsWaiting: 5,
                    },
                ],
            ])
        })
    })

    describe("progressOf", () => {
        it("reads the truths state of the documents of one page by primary key, and nothing for no document", async () => {
            const em = mockEntityManager({
                find: [BrainExtractionEntity, [rowOf({ status: "done", stage: "settle", factsApplied: 6 })]],
            })
            const service = await build(em)

            await expect(service.progressOf(WS, [])).resolves.toEqual([])
            await expect(service.progressOf(WS, ["s1"])).resolves.toEqual([
                {
                    sourceId: "s1",
                    status: "done",
                    windowsDone: 2,
                    windowsTotal: 5,
                    factsProposed: 7,
                    stage: "settle",
                    error: null,
                    counts: {
                        passagesTotal: 40,
                        passagesTriaged: 40,
                        passagesKept: 6,
                        factsApplied: 6,
                        factsAsked: 0,
                        factsWaiting: 0,
                    },
                    windowsSkipped: 0,
                    linesRefused: 0,
                    linesUnread: 0,
                    nature: null,
                },
            ])
            expect(evaluatedCalls(em.find.mock.calls)).toEqual([
                ["BrainExtractionEntity", { where: { workspaceId: WS, sourceId: In(["s1"]) }, take: 500 }],
            ])
        })
    })
})

import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactAreasService } from "./brain-fact-areas.service"
import { BrainFactsService, type FactsChangedHook } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import type { Evidence, FactRecord } from "./brain-facts.contracts"
import { AREA_NOTE_PREFIX, reachNoteOf } from "./fact-audience.policy"
import { BrainFactEntity } from "./persistence/entities"

/** A line of a bicycle workshop's document as the evidence of a truth. */
const lineOf = (sourceId: string): Evidence => ({ kind: "document", ref: sourceId, sourceId, label: "Tune-up prices" })

const MOVE = '"Tune-up prices" internal -> public'

/** The facts store over a manager double, with its reads and listener as doubles the spec arranges. */
const build = async (em: MockEntityManager) => {
    const reads = mock<BrainFactsReadService>()
    reads.keyed.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            BrainFactAreasService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            { provide: InForceBoundService, useValue: mock<InForceBoundService>() },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactsMaintenanceService, useValue: mock<BrainFactsMaintenanceService>() },
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    const service = moduleRef.get(BrainFactAreasService)
    const hook = mock<FactsChangedHook>()
    moduleRef.get(BrainFactsService).whenChanged(hook)
    return { service, reads, hook }
}

/** Which documents are in the public area after the move. */
const publicNow =
    (...ids: ReadonlyArray<string>) =>
    (asked: ReadonlyArray<string>): Promise<ReadonlySet<string>> =>
        Promise.resolve(new Set(asked.filter((id) => ids.includes(id))))

/** The truth in force the spec moves: the tune-up price read from document s1, internal. */
const tuneUp = (fields: Partial<FactRecord> = {}): FactRecord =>
    facts.factOf({
        id: "f1",
        status: "active",
        scope: "internal",
        sourceKind: "document",
        evidence: [lineOf("s1")],
        ...fields,
    })

describe("BrainFactAreasService.followDocumentAreas: a truth follows its document's area, the founder's switch stays", () => {
    it("makes the truth in force of a document moved to public its next version, decided by the mover with a note naming the move", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [BrainFactEntity, { affected: 1 }] }))
        const [supersede, insert] = queueQueryBuilders(tx.em, [
            { execute: { raw: [facts.rowOf({ status: "superseded" })] } },
            { execute: { raw: [facts.rowOf({ id: "f2", status: "active", scope: "public", supersedesId: "f1" })] } },
        ])
        const { service, reads, hook } = await build(tx.em)
        reads.ofSources.mockResolvedValueOnce([tuneUp()]).mockResolvedValueOnce([])

        await expect(service.followDocumentAreas(facts.WS, ["s1"], publicNow("s1"), "Lan", MOVE)).resolves.toEqual([
            "f1",
            "f2",
        ])

        expect(reads.ofSources.mock.calls).toEqual([
            [facts.WS, ["s1"], ["active"], 2000],
            [facts.WS, ["s1"], ["scheduled", "proposed"], 2000],
        ])
        expect(supersede?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "active" }]])
        const written = evaluatedValues(insert?.callsOf("values")[0]?.[0])
        expect(written).toMatchObject({ scope: "public", modules: [], decidedBy: "Lan", supersedesId: "f1" })
        expect(written).toMatchObject({
            decisionNote: `${AREA_NOTE_PREFIX} ${MOVE}; readers internal -> public`,
        })
        expect(hook.factsChanged).toHaveBeenCalledWith(facts.WS, ["f1", "f2"])
    })

    it("moves a public truth back to internal when none of its documents is in the public area any more", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [BrainFactEntity, { affected: 1 }] }))
        const [, insert] = queueQueryBuilders(tx.em, [
            { execute: { raw: [facts.rowOf({ status: "superseded" })] } },
            { execute: { raw: [facts.rowOf({ id: "f2", status: "active", scope: "internal", supersedesId: "f1" })] } },
        ])
        const { service, reads } = await build(tx.em)
        reads.ofSources.mockResolvedValueOnce([tuneUp({ scope: "public" })]).mockResolvedValueOnce([])

        await service.followDocumentAreas(facts.WS, ["s1"], publicNow(), "Lan", '"Tune-up prices" public -> internal')

        expect(evaluatedValues(insert?.callsOf("values")[0]?.[0])).toMatchObject({
            scope: "internal",
            decidedBy: "Lan",
        })
    })

    it("keeps a truth public while another of its documents is still in the public area", async () => {
        const em = mockEntityManager()
        const { service, reads, hook } = await build(em)
        const twoDocuments = tuneUp({ scope: "public", evidence: [lineOf("s1"), lineOf("s9")] })
        reads.ofSources.mockResolvedValueOnce([twoDocuments]).mockResolvedValueOnce([])

        await expect(service.followDocumentAreas(facts.WS, ["s1"], publicNow("s9"), "Lan", MOVE)).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(hook.factsChanged).not.toHaveBeenCalled()
    })

    it("leaves a truth whose audience the founder set with his switch, and his own statement, exactly as they are", async () => {
        const em = mockEntityManager()
        const { service, reads } = await build(em)
        const switched = tuneUp({
            decidedBy: "Ada",
            decisionNote: reachNoteOf({ scope: "public", modules: [] }, { scope: "internal", modules: [] }),
        })
        const stated = tuneUp({ id: "f5", sourceKind: "owner" })
        reads.ofSources.mockResolvedValueOnce([switched, stated]).mockResolvedValueOnce([])

        await expect(service.followDocumentAreas(facts.WS, ["s1"], publicNow("s1"), "Lan", MOVE)).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("writes the audience of a waiting or scheduled value in place, unless the founder switched its key's value in force", async () => {
        const em = mockEntityManager({ update: [BrainFactEntity, { affected: 1 }] })
        const { service, reads, hook } = await build(em)
        const waiting = tuneUp({ id: "f7", status: "proposed" })
        const ruled = tuneUp({ id: "f8", status: "scheduled", subjectKey: "chain", attribute: "price" })
        reads.ofSources.mockResolvedValueOnce([]).mockResolvedValueOnce([waiting, ruled])
        const founderSwitch = tuneUp({
            id: "f0",
            decidedBy: "Ada",
            decisionNote: reachNoteOf({ scope: "public", modules: [] }, { scope: "internal", modules: [] }),
        })
        reads.keyed.mockImplementation((_em, _ws, subjectKey) =>
            Promise.resolve(subjectKey === "chain" ? [founderSwitch] : []),
        )

        await expect(service.followDocumentAreas(facts.WS, ["s1"], publicNow("s1"), "Lan", MOVE)).resolves.toEqual([
            "f7",
        ])

        expect(em.update.mock.calls).toEqual([
            [
                BrainFactEntity,
                { workspaceId: facts.WS, id: "f7", status: In(["scheduled", "proposed"]) },
                { scope: "public", modules: [] },
            ],
        ])
        expect(hook.factsChanged).toHaveBeenCalledWith(facts.WS, ["f7"])
    })
})

import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { stampedValues } from "@tests/fixtures/builders/entity-row.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import { SUPERSEDE } from "./fact-write.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The relations store of the service: a double, so a replacement can be seen carrying the edges. */
const relationsDouble = mock<BrainFactRelationsService>()

const parts = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            InForceBoundService,
            BrainFactsReadService,
            BrainFactsMaintenanceService,
            { provide: BrainFactRelationsService, useValue: relationsDouble },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return {
        service: moduleRef.get(BrainFactsService),
        reads: moduleRef.get(BrainFactsReadService),
        maintenance: moduleRef.get(BrainFactsMaintenanceService),
    }
}

const build = async (em: MockEntityManager) => (await parts(em)).service

/** A write that answered these facts. */
const answered = (...rows: ReadonlyArray<object>) => ({ execute: { raw: rows } })

const setOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("set")[0]?.[0])

/** A service whose key holds these groups of facts, answering a write with these rows, and the first write it runs. */
const writing = async (
    finds: ReadonlyArray<ReadonlyArray<BrainFactEntity>>,
    back: ReadonlyArray<BrainFactEntity> = [facts.rowOf()],
) => {
    const em = mockEntityManager({ find: finds.map((rows) => [BrainFactEntity, rows] as const) })
    const [insert] = queueQueryBuilders(em, [answered(...back)])
    return { em, insert, service: await build(em) }
}

/** What an insert carried: the stamped values and the parameters. */
const insertedBy = (fake: FakeQueryBuilder | undefined) => ({
    values: stampedValues(fake?.callsOf("values")[0]?.[0]),
    parameters: fake?.callsOf("setParameters")[0]?.[0],
})

const registerUpkeep = () => {
    it("only finalizes still unsupported active facts without a waiting value", async () => {
        const retire = facts.rowOf({ proposalKind: "retire" })
        const active = (id: string) => facts.rowOf({ status: "active", id })
        const em = mockEntityManager({
            findOne: [
                [BrainFactEntity, null],
                [BrainFactEntity, facts.rowOf()],
                [BrainFactEntity, facts.rowOf({ status: "active", evidence: [facts.PROOF] })],
                [BrainFactEntity, active("value")],
                [BrainFactEntity, active("retire")],
                [BrainFactEntity, active("file")],
            ],
            find: [
                [BrainFactEntity, [facts.rowOf()]],
                [BrainFactEntity, [retire]],
                [BrainFactEntity, [retire]],
                [BrainFactEntity, []],
                [BrainFactEntity, []],
            ],
        })
        const [insert] = queueQueryBuilders(em, [answered(facts.rowOf())])
        await expect(
            (await build(em)).finalizeOrphans(
                facts.WS,
                ["missing", "proposed", "supported", "value", "retire", "file"],
                facts.PROOF,
            ),
        ).resolves.toBe(1)
        expect(insertedBy(insert).values).toEqual(facts.orphanInsert)
    })

    it("rejects incomplete facts before reaching persistence", async () => {
        const em = mockEntityManager()
        await expect((await build(em)).propose(facts.WS, facts.inputOf({ value: " " }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
        })
        expect(em.find).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("hands reads and upkeep to their services unchanged", async () => {
        const { service, reads, maintenance } = await parts(mockEntityManager())
        const listed = [facts.factOf()]
        const done = { activated: listed, expired: 1 }
        for (const method of ["list", "forView", "search"] as const) jest.spyOn(reads, method).mockResolvedValue(listed)
        jest.spyOn(maintenance, "withdrawSource").mockResolvedValue(["orphan"])
        jest.spyOn(maintenance, "withdrawChanged").mockResolvedValue({ orphans: [], withdrawn: 1 })
        jest.spyOn(maintenance, "maintain").mockResolvedValue(done)
        await expect(service.list(facts.WS, { statuses: ["active"] })).resolves.toBe(listed)
        await expect(service.forView(facts.WS, "customer", "chatbot", null, 5)).resolves.toBe(listed)
        await expect(service.search(facts.WS, "internal", "sales", "i1", "hours", 3)).resolves.toBe(listed)
        await expect(service.withdrawSource(facts.WS, "doc-1", "Removed")).resolves.toEqual(["orphan"])
        await expect(service.withdrawChanged(facts.WS, "d", "n", { hashes: [], folded: "t" })).resolves.toMatchObject({
            withdrawn: 1,
        })
        await expect(service.maintain(facts.WS)).resolves.toBe(done)
        expect(reads.list).toHaveBeenCalledWith(facts.WS, { statuses: ["active"] })
        expect(reads.forView).toHaveBeenCalledWith(facts.WS, "customer", "chatbot", null, 5)
        expect(reads.search).toHaveBeenCalledWith(facts.WS, "internal", "sales", "i1", "hours", 3)
        expect(maintenance.withdrawSource).toHaveBeenCalledWith(facts.WS, "doc-1", "Removed")
        expect(maintenance.maintain).toHaveBeenCalledWith(facts.WS)
    })

    it("files the retirement of an active value that has no number", async () => {
        const { insert, service } = await writing([[]])
        const active = facts.factOf({ status: "active", value: "Open every day", valueNumber: null })
        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(true)
        expect(insertedBy(insert).values).toMatchObject({ value: "Open every day", valueNumber: null })
    })
}

/** A stored proposal the model judged the same fact as `other` (flag `same_meaning`). */
const sameMeaningRow = (): BrainFactEntity => ({
    ...facts.rowOf({ conflictWith: "other" }),
    reviewFlags: ["same_meaning"],
})

const registerPointers = () => {
    it("points a new value at the other value waiting for the key when none is in force: one choice, never two silent proposals (P4)", async () => {
        const { insert, service } = await writing([[], [facts.rowOf({ id: "first", value: "10h" })]])
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toEqual({
            fact: facts.factOf(),
            outcome: "conflict",
            created: true,
        })
        expect(insertedBy(insert).values).toMatchObject({ conflictWith: "first" })
    })

    it("does not point at a waiting retire proposal of the key", async () => {
        const { insert, service } = await writing([
            [],
            [facts.rowOf({ id: "stop", proposalKind: "retire", value: "10h" })],
        ])
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toMatchObject({ outcome: "proposed" })
        expect(insertedBy(insert).values).toMatchObject({ conflictWith: null })
    })

    it("reads the periods before naming what a new value disagrees with: a value stated for a period disagrees with nothing standing, nor with a waiting period it does not overlap; a standing value still names the value in force", async () => {
        const live = facts.rowOf({ id: "live", status: "active", value: "10h" })
        const season = await writing([[live], []])
        await season.service.propose(facts.WS, facts.inputOf({ validFrom: "2030-02-12T00:00:00.000Z", validTo: "2030-02-15T00:00:00.000Z" }))
        expect(insertedBy(season.insert).values).toMatchObject({ conflictWith: null })

        const standing = await writing([[live], []])
        await standing.service.propose(facts.WS, facts.inputOf())
        expect(insertedBy(standing.insert).values).toMatchObject({ conflictWith: "live" })

        const march = facts.rowOf({ id: "march", value: "10h", validFrom: new Date("2030-03-06T00:00:00.000Z"), validTo: new Date("2030-03-09T00:00:00.000Z") })
        const apart = await writing([[], [march]])
        await apart.service.propose(facts.WS, facts.inputOf({ validFrom: "2030-02-12T00:00:00.000Z", validTo: "2030-02-15T00:00:00.000Z" }))
        expect(insertedBy(apart.insert).values).toMatchObject({ conflictWith: null })

        const overlapping = await writing([[], [march]])
        await overlapping.service.propose(facts.WS, facts.inputOf({ validFrom: "2030-03-08T00:00:00.000Z", validTo: "2030-03-20T00:00:00.000Z" }))
        expect(insertedBy(overlapping.insert).values).toMatchObject({ conflictWith: "march" })
    })
}

const registerStaleEnds = () => {
    it("files a value whose stated end has passed as a proposal flagged stale, even from a trusted source (P2)", async () => {
        const { insert, service } = await writing([[]])
        const apply = jest.spyOn(service, "apply")
        await expect(
            service.propose(facts.WS, facts.inputOf({ sourceKind: "owner", validTo: "2026-07-01T00:00:00.000Z" })),
        ).resolves.toMatchObject({ outcome: "proposed", created: true })
        expect(apply).not.toHaveBeenCalled()
        expect(insertedBy(insert).values).toMatchObject({ reviewFlags: ["stale"] })
    })

    it("does not flag an end still ahead", async () => {
        const { insert, service } = await writing([[]])
        await service.propose(facts.WS, facts.inputOf({ validTo: facts.LATER }))
        expect(insertedBy(insert).values).not.toHaveProperty("reviewFlags")
    })

    it("keeps the mark the reading files with a truth (a period that could not be computed), beside what the store notices itself", async () => {
        const { insert, service } = await writing([[]])
        await service.propose(facts.WS, facts.inputOf({ flags: ["period_unclear"] }))
        expect(insertedBy(insert).values).toMatchObject({ reviewFlags: ["period_unclear"] })
    })

    it("records an approved proposal whose end has passed as history: it never comes in force", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, facts.rowOf({ validTo: new Date("2026-07-01T00:00:00.000Z") })],
                find: [BrainFactEntity, [facts.rowOf({ id: "old", status: "active" })]],
            }),
        )
        const [record] = queueQueryBuilders(tx.em, [answered(facts.rowOf({ status: "expired" }))])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).resolves.toEqual(
            facts.factOf({ status: "expired" }),
        )
        expect(record?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "proposed" }]])
        expect(setOf(record)).toMatchObject({
            status: "expired",
            decidedBy: "u2",
            decisionNote: "Recorded as history: its stated end had already passed",
        })
        expect(tx.em.update).not.toHaveBeenCalled()
        expect(relationsDouble.carry).not.toHaveBeenCalled()
    })
}

const registerSameMeaningMerges = () => {
    it("merges a same-meaning proposal over the value in force of the other key: superseded, relations carried, next version", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, sameMeaningRow()],
                    [BrainFactEntity, facts.rowOf({ id: "other", subjectKey: "tiem", status: "active" })],
                ],
                find: [BrainFactEntity, []],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [activate] = queueQueryBuilders(tx.em, [answered(facts.rowOf({ status: "active" }))])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).resolves.toEqual(
            facts.factOf({ status: "active" }),
        )
        expect(evaluatedCalls(tx.em.update.mock.calls, 2)).toEqual([
            ["BrainFactEntity", { workspaceId: facts.WS, id: "other", status: "active" }, evaluatedValues(SUPERSEDE)],
        ])
        expect(setOf(activate)).toMatchObject({
            status: "active",
            supersedesId: "other",
            conflictWith: null,
            version: 1,
        })
        expect(relationsDouble.carry.mock.calls.map((call) => call.slice(1))).toEqual([[facts.WS, "other", "f1"]])
        relationsDouble.carry.mockClear()
    })

    it("merges a same-meaning proposal over the other WAITING value: that one is rejected, nothing else is superseded", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, sameMeaningRow()],
                    [BrainFactEntity, facts.rowOf({ id: "other", subjectKey: "tiem" })],
                ],
                find: [BrainFactEntity, []],
            }),
        )
        const [reject, activate] = queueQueryBuilders(tx.em, [
            answered(facts.rowOf({ id: "other", status: "rejected" })),
            answered(facts.rowOf({ status: "active" })),
        ])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).resolves.toEqual(
            facts.factOf({ status: "active" }),
        )
        expect(reject?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "other", status: "proposed" }]])
        expect(setOf(reject)).toMatchObject({
            status: "rejected",
            decisionNote: "Merged: the founder approved the same fact in other words",
        })
        expect(setOf(activate)).toMatchObject({ status: "active", supersedesId: null })
        expect(relationsDouble.carry).not.toHaveBeenCalled()
    })
}

const registerSameMeaningFlags = () => {
    it("applies a same-meaning proposal plainly once the other fact was decided meanwhile", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, sameMeaningRow()],
                    [BrainFactEntity, facts.rowOf({ id: "other", status: "rejected" })],
                ],
                find: [BrainFactEntity, []],
            }),
        )
        const [activate] = queueQueryBuilders(tx.em, [answered(facts.rowOf({ status: "active" }))])
        await (await build(tx.em)).apply(facts.WS, "f1", "u2")
        expect(setOf(activate)).toMatchObject({ status: "active", supersedesId: null })
    })

    it("flags a waiting proposal that disagrees with nothing as the same fact as another, and nothing else", async () => {
        const em = mockEntityManager()
        const [flag, none] = queueQueryBuilders(em, [{ execute: { affected: 1 } }, { execute: { affected: 0 } }])
        const service = await build(em)
        await expect(service.flagSameMeaning(facts.WS, "f1", "other")).resolves.toBe(true)
        expect(flag?.callsOf("where")).toEqual([
            [{ workspaceId: facts.WS, id: "f1", status: "proposed", proposalKind: "set", conflictWith: IsNull() }],
        ])
        expect(setOf(flag)).toEqual({
            conflictWith: "other",
            reviewFlags: "array_append(review_flags, 'same_meaning')",
        })
        await expect(service.flagSameMeaning(facts.WS, "f1", "other")).resolves.toBe(false)
        expect(none?.callsOf("where")).toHaveLength(1)
        await expect(service.flagSameMeaning(facts.WS, "f1", "f1")).resolves.toBe(false)
    })
}

describe("BrainFactsService: upkeep and reads", () => {
    registerUpkeep()
})

describe("BrainFactsService: truth checks (BG2)", () => {
    registerPointers()
    registerStaleEnds()
})

describe("BrainFactsService: same-meaning merges and flags (BG2)", () => {
    registerSameMeaningMerges()
    registerSameMeaningFlags()
})

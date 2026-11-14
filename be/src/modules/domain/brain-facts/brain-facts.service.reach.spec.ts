import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { stampedValues } from "@tests/fixtures/builders/entity-row.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import { SUPERSEDE } from "./fact-write.policy"
import type { Scope } from "./brain-facts.contracts"
import { BrainFactEntity } from "./persistence/entities"
import { DONG_VI, PRICE_30K_VI, PRICE_32K_PER_ORDER_VI } from "@tests/fixtures/i18n/brain-facts-spec.messages"
import { HASH_STATEMENT, LOCK_HASH, LOCK_STATEMENT, advisoryLockAnswers } from "@tests/fixtures/builders/advisory-lock.builder"

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

/** The condition of the facts of the spec key in a status, in the workspace-wide scope unless an installation is named. */
const keyed = (status: string, installationId: string | null = null) => ({
    workspaceId: facts.WS,
    subjectKey: "shop",
    attribute: "hours",
    installationId: installationId ?? IsNull(),
    status,
})

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

/** The condition of the values of the key not yet in force. */
const plans = (installationId: string | null = null) => ({
    ...keyed("proposed", installationId),
    status: In(["scheduled", "proposed"]),
})

/** A pointer of the facts in one status moved from the old version to the new one. */
const repointed = (status: string, column: string) => [
    BrainFactEntity,
    { workspaceId: facts.WS, status, [column]: "f1" },
    { [column]: "f2" },
]

/** The audience columns a reach switch writes onto the values of the key not yet in force. */
const reached = (scope: Scope, modules: ReadonlyArray<string>) => ({ scope, modules: [...modules] })

const registerReachNextVersion = () => {
    it("changes who reads the value in force: next version, same value and evidence, old superseded, relations and plans carried", async () => {
        const old = {
            ...facts.rowOf({ status: "active", validTo: new Date(facts.LATER), evidence: [facts.PROOF] }),
            version: 2,
        }
        const tx = fakeTransaction(
            mockEntityManager({ findOne: [BrainFactEntity, old], update: [BrainFactEntity, { affected: 1 }] }),
        )
        const fresh = {
            ...facts.rowOf({ id: "f2", status: "active", scope: "public", supersedesId: "f1" }),
            version: 3,
        }
        const [supersede, insert] = queueQueryBuilders(tx.em, [
            answered({ ...old, status: "superseded" }),
            answered(fresh),
        ])

        await expect(
            (await build(tx.em)).setReach(facts.WS, "f1", { scope: "public", modules: ["sales"] }, "Ada"),
        ).resolves.toEqual(
            facts.factOf({ id: "f2", status: "active", scope: "public", supersedesId: "f1", version: 3 }),
        )

        expect(supersede?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "active" }]])
        expect(setOf(supersede)).toEqual(evaluatedValues(SUPERSEDE))
        expect(evaluatedValues(insert?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: facts.WS,
            installationId: null,
            subjectType: "business",
            subjectKey: "shop",
            subjectLabel: "Shop",
            attribute: "hours",
            attributeLabel: "Hours",
            value: "8h",
            valueNumber: "8",
            unit: null,
            scope: "public",
            modules: [],
            status: "active",
            sourceKind: "staff",
            trust: 60,
            supersedesId: "f1",
            proposalKind: "set",
            proposedBy: "Ada",
            decidedBy: "Ada",
            decidedAt: "now()",
            decisionNote: "Who reads it changed: internal -> public",
            version: 3,
            validFrom: "coalesce(:validFrom::timestamptz, now())",
            validTo: "coalesce(:validTo::timestamptz, coalesce(:validFrom::timestamptz, now()) + interval '1 year')",
            evidence: ":evidence::jsonb",
        })
        expect(insert?.callsOf("setParameters")).toEqual([
            [
                {
                    workspaceId: facts.WS,
                    validFrom: null,
                    validTo: facts.LATER,
                    evidence: JSON.stringify([facts.PROOF]),
                },
            ],
        ])
        expect(relationsDouble.carry.mock.calls.map((call) => call.slice(1))).toEqual([[facts.WS, "f1", "f2"]])
        relationsDouble.carry.mockClear()
        expect(tx.em.update.mock.calls).toEqual([
            [BrainFactEntity, plans(), reached("public", [])],
            repointed("scheduled", "supersedesId"),
            repointed("proposed", "conflictWith"),
        ])
        expect(tx.commits).toBe(1)
    })
}

const registerReachRules = () => {
    it("keeps the modules of a restricted reach once each, inside the fact's own instance", async () => {
        const old = facts.rowOf({ status: "active", installationId: "inst-1" })
        const tx = fakeTransaction(
            mockEntityManager({ findOne: [BrainFactEntity, old], update: [BrainFactEntity, { affected: 1 }] }),
        )
        const [, insert] = queueQueryBuilders(tx.em, [
            answered(old),
            answered(facts.rowOf({ id: "f2", status: "active" })),
        ])

        await (
            await build(tx.em)
        ).setReach(facts.WS, "f1", { scope: "restricted", modules: ["sales", "sales", "accounting"] }, "Ada")

        expect(evaluatedValues(insert?.callsOf("values")[0]?.[0])).toMatchObject({
            installationId: "inst-1",
            scope: "restricted",
            modules: ["sales", "accounting"],
            version: 1,
            decisionNote: "Who reads it changed: internal -> restricted sales accounting",
            validTo: "coalesce(:validTo::timestamptz, coalesce(:validFrom::timestamptz, now()) + interval '1 year')",
        })
        expect(tx.em.update.mock.calls[0]).toEqual([
            BrainFactEntity,
            plans("inst-1"),
            reached("restricted", ["sales", "accounting"]),
        ])
        relationsDouble.carry.mockClear()
    })

    it("writes nothing when the fact already has that reach", async () => {
        const old = facts.rowOf({ status: "active", scope: "restricted", modules: ["sales", "crm"] })
        const tx = fakeTransaction(mockEntityManager({ findOne: [BrainFactEntity, old] }))

        await expect(
            (await build(tx.em)).setReach(facts.WS, "f1", { scope: "restricted", modules: ["crm", "sales"] }, "Ada"),
        ).resolves.toEqual(facts.factOf({ status: "active", scope: "restricted", modules: ["sales", "crm"] }))
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
        expect(tx.em.update).not.toHaveBeenCalled()
        expect(relationsDouble.carry).not.toHaveBeenCalled()
    })

    it.each([
        { row: null, code: BrainFactsErrorCode.FactNotFound },
        { row: facts.rowOf({ status: "proposed" }), code: BrainFactsErrorCode.NotActive },
        { row: facts.rowOf({ status: "superseded" }), code: BrainFactsErrorCode.NotActive },
        { row: facts.rowOf({ status: "active", validTo: new Date(facts.AT) }), code: BrainFactsErrorCode.NotActive },
    ])("refuses a fact that is absent, not in force or ended, writing nothing ($code)", async ({ row, code }) => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [BrainFactEntity, row] }))
        await expect(
            (await build(tx.em)).setReach(facts.WS, "f1", { scope: "public", modules: [] }, "Ada"),
        ).rejects.toMatchObject({
            code,
        })
        expect(tx.rollbacks).toBe(1)
        expect(tx.committedWrites).toEqual([])
    })

    it("rolls back when the value left force meanwhile", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [BrainFactEntity, facts.rowOf({ status: "active" })] }))
        queueQueryBuilders(tx.em, [answered()])
        await expect(
            (await build(tx.em)).setReach(facts.WS, "f1", { scope: "public", modules: [] }, "Ada"),
        ).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotActive,
        })
        expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(tx.rollbacks).toBe(1)
    })
}

describe("BrainFactsService: who reads a fact (FX7, the 'customers may know' switch)", () => {
    registerReachNextVersion()
    registerReachRules()
})

describe("BrainFactsService: one normal form of value and unit on every write door (D-T5-1)", () => {
    const valuesOf = (fake: FakeQueryBuilder | undefined) => stampedValues(fake?.callsOf("values")[0]?.[0])

    it("a value that already names its unit keeps no unit apart (the live per-order price with its unit of a chat change request)", async () => {
        const { insert, service } = await writing([[]])

        await service.propose(facts.WS, facts.inputOf({ value: PRICE_32K_PER_ORDER_VI, unit: DONG_VI }))

        expect(valuesOf(insert)).toMatchObject({ value: PRICE_32K_PER_ORDER_VI, unit: null })
    })

    it("a value that ends with its unit is kept without that tail, the unit apart (the policy tab's price in dong)", async () => {
        const { insert, service } = await writing([[]])

        await service.propose(facts.WS, facts.inputOf({ value: PRICE_30K_VI, unit: DONG_VI }))

        expect(valuesOf(insert)).toMatchObject({ value: "30.000", valueNumber: "30000", unit: DONG_VI })
    })

    it("the unit of the fact in force counts too: a new value naming it is not given it a second time", async () => {
        const active = facts.rowOf({ status: "active", value: "30.000", valueNumber: "30000", unit: DONG_VI })
        const { insert, service } = await writing([[active], []])

        await service.propose(facts.WS, facts.inputOf({ value: PRICE_32K_PER_ORDER_VI }))

        expect(valuesOf(insert)).toMatchObject({ value: PRICE_32K_PER_ORDER_VI, unit: null })
    })

    it("the same value written with its unit is the value in force, not a new proposal", async () => {
        const active = facts.rowOf({ status: "active", trust: 95, value: "30.000", valueNumber: "30000", unit: DONG_VI })
        const em = mockEntityManager({ find: [BrainFactEntity, [active]], update: [BrainFactEntity, { affected: 0 }] })
        queueQueryBuilders(em, [answered(active)])
        const service = await build(em)

        await expect(service.propose(facts.WS, facts.inputOf({ value: PRICE_30K_VI, unit: DONG_VI }))).resolves.toMatchObject(
            {
                outcome: "reinforced",
            },
        )
    })
})

/** The two counts a bounded apply reads, as the database answers them (a count comes back as text). */
interface Counts {
    /** The truths in force. */
    readonly truths: string
    /** The bytes of the truths in force. */
    readonly bytes: string
}


describe("BrainFactsService: a bounded apply checks the room and writes in ONE step (D-U-1, the ceiling under parallel settles)", () => {
    const BOUND = { truths: 3, bytes: 1_000 }

    /** A waiting value with no value in force for its key, the two counts the bounded apply reads, and the row the write answers. */
    const bounded = async (before: Counts, after: Counts) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: advisoryLockAnswers,
                findOne: [BrainFactEntity, facts.rowOf()],
                find: [BrainFactEntity, []],
            }),
        )
        const [countBefore, write, countAfter] = queueQueryBuilders(tx.em, [
            { getRawOne: before },
            answered(facts.rowOf({ status: "active" })),
            { getRawOne: after },
        ])
        return { tx, countBefore, write, countAfter, service: await build(tx.em) }
    }

    it("takes the workspace's in-force lock FIRST, counts, writes, counts again, and commits a write that fits", async () => {
        const { tx, countBefore, countAfter, service } = await bounded({ truths: "2", bytes: "200" }, { truths: "3", bytes: "300" })

        await expect(service.applyUnannounced(facts.WS, "f1", "u2", "direct", BOUND)).resolves.toEqual(facts.factOf({ status: "active" }))

        // The lock is keyed by the workspace: bounded applies of ONE workspace run one after the other, other workspaces are not held up.
        expect(tx.em.query.mock.calls).toEqual([
            [HASH_STATEMENT, [`brain-facts.in-force:${facts.WS}`, 0]],
            [LOCK_STATEMENT, [LOCK_HASH]],
        ])
        // In force = active and scheduled, counted inside the transaction (it sees its own write).
        expect(countBefore?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, status: In(["active", "scheduled"]) }]])
        expect(countAfter?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, status: In(["active", "scheduled"]) }]])
        expect(tx.outcomes).toEqual(["commit"])
    })

    it.each([
        ["one truth more than the bound", { truths: "3", bytes: "300" }, { truths: "4", bytes: "400" }],
        ["more bytes than the bound", { truths: "1", bytes: "950" }, { truths: "2", bytes: "1001" }],
    ])("refuses a write that takes the workspace over the bound (%s): the transaction rolls back, nothing is written", async (_what, before, after) => {
        const { tx, service } = await bounded(before, after)

        await expect(service.applyUnannounced(facts.WS, "f1", "u2", "direct", BOUND)).rejects.toMatchObject({
            code: BrainFactsErrorCode.InForceFull,
        })

        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.committedWrites).toEqual([])
    })

    it("never refuses a write that adds nothing, even in a workspace already above the bound (the founder's writes are not bounded)", async () => {
        // The next version of a value in force replaces it: the count and the bytes stay.
        const { tx, service } = await bounded({ truths: "9", bytes: "5000" }, { truths: "9", bytes: "5000" })

        await expect(service.applyUnannounced(facts.WS, "f1", "u2", "updated", BOUND)).resolves.toMatchObject({ status: "active" })

        expect(tx.outcomes).toEqual(["commit"])
    })

    it("an apply with no bound (the founder's decision) takes no lock and counts nothing", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [BrainFactEntity, facts.rowOf()], find: [BrainFactEntity, []] }))
        queueQueryBuilders(tx.em, [answered(facts.rowOf({ status: "active" }))])

        await expect((await build(tx.em)).applyUnannounced(facts.WS, "f1", "u2")).resolves.toMatchObject({ status: "active" })

        // `query` is not stubbed: a lock statement would have thrown.
        expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(tx.outcomes).toEqual(["commit"])
    })
})

import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
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
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import { BrainFactEntity } from "./persistence/entities"

const parts = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            BrainFactsReadService,
            BrainFactsMaintenanceService,
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

const registerReinforce = () => {
    it.each([{ evidence: [] }, { evidence: [facts.PROOF] }])(
        "reinforces an active value with evidence %j",
        async ({ evidence }) => {
            const active = facts.rowOf({ status: "active", trust: 95 })
            const em = mockEntityManager({
                find: [BrainFactEntity, [active]],
                update: [BrainFactEntity, { affected: 0 }],
            })
            const [grow] = queueQueryBuilders(em, [answered(active)])
            const service = await build(em)
            await expect(service.propose(facts.WS, facts.inputOf({ evidence }))).resolves.toEqual({
                fact: facts.factOf({ status: "active", trust: 95 }),
                outcome: "reinforced",
            })
            expect(grow?.callsOf("setParameters")).toEqual([[{ evidence: JSON.stringify(evidence) }]])
            expect(setOf(grow)).toMatchObject({ trust: 95 })
            if (evidence.length > 0)
                expect(evaluatedCalls(em.update.mock.calls, 2)).toEqual([
                    [
                        "BrainFactEntity",
                        { ...keyed("proposed"), status: "proposed", proposalKind: "retire" },
                        {
                            status: "rejected",
                            decidedAt: "now()",
                            decisionNote: "A source confirmed this value again",
                        },
                    ],
                ])
            else expect(em.update).not.toHaveBeenCalled()
        },
    )

    it.each([false, true])("reinforces a waiting value with an active conflict %s", async (hasActive) => {
        const waiting = [facts.rowOf({ proposalKind: "retire" }), facts.rowOf({ value: "10h" }), facts.rowOf()]
        const { insert: grow, service } = await writing([
            hasActive ? [facts.rowOf({ id: "old", value: "9h" })] : [],
            waiting,
        ])
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toEqual({
            fact: facts.factOf(),
            outcome: hasActive ? "conflict" : "proposed",
        })
        expect(grow?.callsOf("setParameters")).toEqual([[{ evidence: "[]" }]])
        expect(setOf(grow)).toMatchObject({ trust: 60 })
    })

    it("applies a waiting value when the trusted owner confirms it", async () => {
        const { insert: grow, service } = await writing([[], [facts.rowOf()]], [facts.rowOf({ trust: 95 })])
        const apply = jest.spyOn(service, "apply").mockResolvedValue(facts.factOf({ status: "active" }))
        await expect(service.propose(facts.WS, facts.inputOf({ sourceKind: "owner" }))).resolves.toEqual({
            fact: facts.factOf({ status: "active" }),
            outcome: "applied",
        })
        expect(setOf(grow)).toMatchObject({ trust: 95 })
        expect(apply).toHaveBeenCalledWith(facts.WS, "f1", "u1")
    })
}

/** What an insert carried: the stamped values and the parameters. */
const insertedBy = (fake: FakeQueryBuilder | undefined) => ({
    values: stampedValues(fake?.callsOf("values")[0]?.[0]),
    parameters: fake?.callsOf("setParameters")[0]?.[0],
})

const registerInsert = () => {
    it("creates an ordinary proposal with defaults", async () => {
        const { insert, service } = await writing([[]])
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toEqual({
            fact: facts.factOf(),
            outcome: "proposed",
        })
        expect(insertedBy(insert)).toEqual({ values: facts.insertedOf(), parameters: facts.insertParametersOf() })
        const values = evaluatedValues(insert?.callsOf("values")[0]?.[0])
        expect({ validFrom: values.validFrom, validTo: values.validTo, evidence: values.evidence }).toEqual({
            validFrom: ":validFrom::timestamptz",
            validTo: ":validTo::timestamptz",
            evidence: ":evidence::jsonb",
        })
    })

    it("inherits the active value's type, restricted modules and unit for a conflict", async () => {
        const { insert, service } = await writing([[facts.conflictingActive], []])
        await expect(service.propose(facts.WS, facts.inputOf({ unit: " " }))).resolves.toEqual({
            fact: facts.factOf(),
            outcome: "conflict",
        })
        expect(insertedBy(insert)).toEqual({ values: facts.conflictInsert, parameters: facts.insertParametersOf() })
    })

    it("honors explicit fields and auto-applies the new value", async () => {
        const { insert, service } = await writing([[]])
        const apply = jest.spyOn(service, "apply").mockResolvedValue(facts.factOf({ status: "active" }))
        await expect(service.propose(facts.WS, facts.inputOf(facts.explicitInput))).resolves.toEqual({
            fact: facts.factOf({ status: "active" }),
            outcome: "applied",
        })
        expect(insertedBy(insert)).toEqual({
            values: facts.explicitInsert,
            parameters: facts.insertParametersOf({
                validFrom: facts.AT,
                validTo: facts.LATER,
                evidence: JSON.stringify([facts.PROOF]),
            }),
        })
        expect(apply).toHaveBeenCalledWith(facts.WS, "f1", "u1")
    })

    it("creates a restricted text proposal without modules and reports an insert that returns no fact", async () => {
        const { insert, service } = await writing([[]], [])
        const input = facts.inputOf({ scope: "restricted", autoApply: false, value: "Open every day" })
        await expect(service.propose(facts.WS, input)).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
        })
        expect(insertedBy(insert).values).toEqual({
            ...facts.restrictedInsert,
            value: "Open every day",
            valueNumber: null,
        })
    })

    it.each([null, facts.factOf({ status: "active" }), facts.factOf({ proposalKind: "retire" })])(
        "guards choosing and splitting invalid proposals %j",
        async (fact) => {
            const service = await build(mockEntityManager())
            jest.spyOn(service, "get").mockResolvedValue(fact)
            const code =
                fact?.proposalKind === "retire" ? BrainFactsErrorCode.NotAValue : BrainFactsErrorCode.NotProposed
            await expect(service.choose(facts.WS, "f1", "u2")).rejects.toMatchObject({ code })
            await expect(service.split(facts.WS, "f1", "Weekend", "u2")).rejects.toMatchObject({ code })
        },
    )

    it.each([{ row: null }, { row: facts.rowOf({ status: "active" }) }])(
        "rolls back approval of absent or decided facts %j",
        async ({ row }) => {
            const tx = fakeTransaction(mockEntityManager({ findOne: [BrainFactEntity, row] }))
            await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).rejects.toMatchObject({
                code: row === null ? BrainFactsErrorCode.FactNotFound : BrainFactsErrorCode.NotProposed,
            })
            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        },
    )
}

const registerApply = () => {
    it.each([false, true])("activates an approved fact with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, facts.rowOf({ validFrom: current ? new Date(facts.AT) : null })],
                find: [BrainFactEntity, current ? [facts.rowOf({ id: "old" })] : []],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [activate] = queueQueryBuilders(tx.em, [answered(facts.rowOf({ status: "active" }))])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2", current ? " approved " : " ")).resolves.toEqual(
            facts.factOf({ status: "active" }),
        )
        expect(activate?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "proposed" }]])
        expect(setOf(activate)).toEqual({
            status: "active",
            supersedesId: current ? "old" : null,
            conflictWith: null,
            decidedBy: "u2",
            decidedAt: "now()",
            decisionNote: current ? "approved" : null,
            validFrom: "coalesce(valid_from, now())",
        })
        expect(evaluatedCalls(tx.em.update.mock.calls, 2)).toEqual(
            current
                ? [
                      [
                          "BrainFactEntity",
                          { workspaceId: facts.WS, id: "old", status: "active" },
                          { status: "superseded", validTo: "coalesce(valid_to, now())" },
                      ],
                  ]
                : [],
        )
        expect(tx.commits).toBe(1)
    })

    it.each([false, true])("schedules future facts with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, facts.rowOf({ validFrom: new Date(facts.LATER) })],
                find: [BrainFactEntity, current ? [facts.rowOf({ id: "old" })] : []],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const writes = queueQueryBuilders(tx.em, [
            ...(current ? [{ execute: {} }] : []),
            answered(facts.rowOf({ status: "scheduled" })),
        ])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).resolves.toEqual(
            facts.factOf({ status: "scheduled" }),
        )
        const schedule = writes[writes.length - 1]
        expect(setOf(schedule)).toMatchObject({
            status: "scheduled",
            supersedesId: current ? "old" : null,
            decidedBy: "u2",
        })
        expect(evaluatedCalls(tx.em.update.mock.calls, 2)).toEqual([
            [
                "BrainFactEntity",
                keyed("scheduled"),
                { status: "rejected", decisionNote: "Replaced by a newer schedule" },
            ],
        ])
        if (current) {
            expect(writes[0]?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "old", status: "active" }]])
            expect(writes[0]?.callsOf("setParameter")).toEqual([["validTo", facts.LATER]])
            expect(setOf(writes[0])).toEqual({ validTo: ":validTo::timestamptz" })
        } else expect(writes).toHaveLength(1)
    })
}

const registerDecisions = () => {
    it.each([undefined, " because "])("applies retirement proposals with reason %s", async (note) => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, facts.rowOf({ proposalKind: "retire" })],
                find: [BrainFactEntity, [facts.rowOf({ id: "old" })]],
            }),
        )
        const [retire, close] = queueQueryBuilders(tx.em, [
            answered(facts.rowOf({ status: "expired" })),
            answered(facts.rowOf({ status: "expired" })),
        ])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2", note)).resolves.toEqual(
            facts.factOf({ status: "expired" }),
        )
        expect(retire?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "old", status: "active" }]])
        expect(setOf(retire)).toMatchObject({
            status: "expired",
            decidedBy: "u2",
            decisionNote: note === undefined ? "No source supports this value any more" : "because",
            validTo: "now()",
        })
        expect(close?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "proposed" }]])
        expect(setOf(close)).toMatchObject({
            status: "expired",
            decisionNote: note === undefined ? "Stopped using" : "because",
        })
    })

    it("closes a retirement proposal even when the active fact is already gone", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, facts.rowOf({ proposalKind: "retire" })],
                find: [BrainFactEntity, []],
            }),
        )
        queueQueryBuilders(tx.em, [answered()])
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it.each([undefined, " ", " reason "])("rejects and retires with trimmed reason %s", async (note) => {
        const em = mockEntityManager()
        const [reject, retire] = queueQueryBuilders(em, [
            answered(facts.rowOf({ status: "rejected" })),
            answered(facts.rowOf({ status: "expired" })),
        ])
        const service = await build(em)
        await expect(service.reject(facts.WS, "f1", "u2", note)).resolves.toEqual(facts.factOf({ status: "rejected" }))
        await expect(service.retire(facts.WS, "f1", "u2", note)).resolves.toEqual(facts.factOf({ status: "expired" }))
        const decisionNote = note === " reason " ? "reason" : null
        expect(reject?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "proposed" }]])
        expect(setOf(reject)).toMatchObject({ status: "rejected", decidedBy: "u2", decisionNote })
        expect(retire?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "active" }]])
        expect(setOf(retire)).toMatchObject({ status: "expired", decidedBy: "u2", decisionNote })
    })

    it("rejects writes that find no proposed or active fact", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [answered(), answered()])
        const service = await build(em)
        await expect(service.reject(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        await expect(service.retire(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotActive,
        })
    })
}

const registerChoices = () => {
    it("chooses one value and rejects the other values and retirement proposals", async () => {
        const service = await build(mockEntityManager())
        jest.spyOn(service, "get").mockResolvedValue(facts.factOf())
        const apply = jest.spyOn(service, "apply").mockResolvedValue(facts.factOf({ status: "active" }))
        const byKey = jest
            .spyOn(service, "byKey")
            .mockResolvedValue([
                facts.factOf(),
                facts.factOf({ id: "f2" }),
                facts.factOf({ id: "f3", proposalKind: "retire" }),
            ])
        const reject = jest.spyOn(service, "reject").mockResolvedValue(facts.factOf({ status: "rejected" }))
        await expect(service.choose(facts.WS, "f1", "u2")).resolves.toEqual(facts.factOf({ status: "active" }))
        expect(apply).toHaveBeenCalledWith(facts.WS, "f1", "u2", "Chosen among several different values")
        expect(byKey).toHaveBeenCalledWith(facts.WS, "shop", "hours", "proposed", null)
        expect(reject.mock.calls).toEqual([
            [facts.WS, "f2", "u2", "Another value was chosen: 8h"],
            [facts.WS, "f3", "u2", "A new value was chosen"],
        ])
    })

    it("keeps the current value and counts rejected proposals", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactEntity, [facts.rowOf(), facts.rowOf({ id: "f2" })]],
                [BrainFactEntity, []],
            ],
        })
        const writes = queueQueryBuilders(em, [answered(facts.rowOf({ status: "rejected" })), answered(facts.rowOf())])
        const service = await build(em)
        await expect(service.keepCurrent(facts.WS, "shop", "hours", "u2", "i1")).resolves.toBe(2)
        await expect(service.keepCurrent(facts.WS, "shop", "hours", "u2", "i1")).resolves.toBe(0)
        expect(writes[1]?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f2", status: "proposed" }]])
        expect(setOf(writes[1])).toMatchObject({ decisionNote: "Kept the value in force", decidedBy: "u2" })
    })

    it("requires a situation and splits a value into its own automatically applied fact", async () => {
        const service = await build(mockEntityManager())
        jest.spyOn(service, "get").mockResolvedValue(facts.factOf())
        const propose = jest
            .spyOn(service, "propose")
            .mockResolvedValue({ fact: facts.factOf({ id: "new" }), outcome: "applied" })
        const reject = jest.spyOn(service, "reject").mockResolvedValue(facts.factOf({ status: "rejected" }))
        await expect(service.split(facts.WS, "f1", " ", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.SituationRequired,
        })
        await expect(service.split(facts.WS, "f1", " Weekend ", "u2")).resolves.toEqual(facts.factOf({ id: "new" }))
        expect(propose).toHaveBeenCalledWith(facts.WS, facts.splitProposal)
        expect(reject).toHaveBeenCalledWith(facts.WS, "f1", "u2", "Split into its own fact: Hours (Weekend)")
    })

    it("files a retirement only once and retains the complete active value", async () => {
        const { em, insert, service } = await writing([[facts.rowOf()], [facts.rowOf({ proposalKind: "retire" })]])
        const active = facts.factOf({ status: "active", installationId: "i1", modules: ["sales"] })
        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(true)
        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(false)
        expect(insertedBy(insert)).toEqual({
            values: facts.retirementInsert,
            parameters: facts.insertParametersOf({ evidence: JSON.stringify([facts.PROOF]) }),
        })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
}

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
        await expect(service.withdrawChanged(facts.WS, "d", "n", "t")).resolves.toMatchObject({ withdrawn: 1 })
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

describe("BrainFactsService", () => {
    registerReinforce()
    registerInsert()
    registerApply()
    registerDecisions()
    registerChoices()
    registerUpkeep()
})

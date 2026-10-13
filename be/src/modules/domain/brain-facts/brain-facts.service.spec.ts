import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { Evidence, FactInput, FactRecord } from "./brain-facts.contracts"
import { BrainFactsService } from "./brain-facts.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import type { BrainFactRow } from "./persistence/brain-facts.rows"
import {
    ACTIVATE_FACT,
    CLOSE_RETIRE_PROPOSAL,
    END_ACTIVE_AT,
    EXPIRE_DUE_FACTS,
    INSERT_FACT,
    PROMOTE_FACT,
    REJECT_FACT,
    REJECT_RETIRE_PROPOSALS,
    REJECT_SCHEDULED,
    RETIRE_FACT,
    SCHEDULE_FACT,
    SELECT_DUE_FACTS,
    SELECT_FACT,
    SELECT_FACTS,
    SELECT_FACTS_BY_KEY,
    SELECT_FACTS_OF_DOCUMENT,
    SUPERSEDE_FACT,
    UPDATE_EVIDENCE,
    UPDATE_EVIDENCE_ONLY,
} from "./persistence/brain-facts.sql"

const WS = "ws-1"
const AT = "2026-10-12T10:00:00.000Z"
const LATER = "2026-10-13T10:00:00.000Z"
const PROOF: Evidence = { kind: "document", ref: "doc-1", label: "Hours" }
const OTHER: Evidence = { kind: "manual", ref: "doc-1", label: "Owner" }
const inputOf = builder<FactInput>({
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8h",
    sourceKind: "staff",
    proposedBy: "u1",
})
const rowOf = builder<BrainFactRow>({
    id: "f1",
    workspace_id: WS,
    installation_id: null,
    subject_type: "business",
    subject_key: "shop",
    subject_label: "Shop",
    attribute: "hours",
    attribute_label: "Hours",
    value: "8h",
    value_number: 8,
    unit: null,
    scope: "internal",
    modules: [],
    status: "proposed",
    source_kind: "staff",
    trust: 60,
    valid_from: null,
    valid_to: null,
    supersedes_id: null,
    conflict_with: null,
    proposal_kind: "set",
    evidence: [],
    proposed_by: "u1",
    proposed_at: AT,
    decided_by: null,
    decided_at: null,
    decision_note: null,
})
const factOf = builder<FactRecord>({
    id: "f1",
    installationId: null,
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8h",
    valueNumber: 8,
    unit: null,
    scope: "internal",
    modules: [],
    status: "proposed",
    sourceKind: "staff",
    trust: 60,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "u1",
    proposedAt: AT,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})
const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsService)
}

describe("BrainFactsService", () => {
    it("reads a fact or null and keys its queries by workspace and installation", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACT, [rowOf()]],
                [SELECT_FACT, []],
                [SELECT_FACTS_BY_KEY, [rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.get(WS, "f1")).resolves.toEqual(factOf())
        await expect(service.get(WS, "absent")).resolves.toBeNull()
        await expect(service.byKey(WS, "shop", "hours", "proposed", "i1")).resolves.toEqual([factOf()])
        expect(em.query.mock.calls).toEqual([
            [SELECT_FACT, [WS, "f1"]],
            [SELECT_FACT, [WS, "absent"]],
            [SELECT_FACTS_BY_KEY, [WS, "shop", "hours", "proposed", "i1"]],
        ])
    })

    it("lists with defaults or explicit filters and bounds the result count", async () => {
        const em = mockEntityManager({ query: [SELECT_FACTS, [rowOf()]] })
        const service = await build(em)
        await expect(service.list(WS, {})).resolves.toEqual([factOf()])
        await expect(service.list(WS, { statuses: ["proposed"], subjectKey: "shop", limit: 3000 })).resolves.toEqual([
            factOf(),
        ])
        expect(em.query.mock.calls).toEqual([
            [SELECT_FACTS, [WS, null, null, 500]],
            [SELECT_FACTS, [WS, ["proposed"], "shop", 2000]],
        ])
    })

    it("filters active facts by the current instant and audience", async () => {
        const em = mockEntityManager({
            query: [
                SELECT_FACTS,
                [
                    rowOf({ scope: "public", status: "active" }),
                    rowOf({ id: "future", valid_from: LATER }),
                    rowOf({ id: "private", scope: "internal" }),
                ],
            ],
        })
        const service = await build(em)
        await expect(service.forView(WS, "customer", "sales", null, 7)).resolves.toEqual([
            factOf({ scope: "public", status: "active" }),
        ])
        expect(em.query).toHaveBeenCalledWith(SELECT_FACTS, [WS, ["active"], null, 7])
    })

    it("searches a view of at most 500 active facts", async () => {
        const service = await build(mockEntityManager())
        const view = jest.spyOn(service, "forView").mockResolvedValue([factOf()])
        await expect(service.search(WS, "internal", "sales", "i1", "shop", 1)).resolves.toEqual([factOf()])
        expect(view).toHaveBeenCalledWith(WS, "internal", "sales", "i1", 500)
    })

    it("rejects incomplete facts before reaching persistence", async () => {
        const em = mockEntityManager()
        await expect((await build(em)).propose(WS, inputOf({ value: " " }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([{ evidence: [] }, { evidence: [PROOF] }])(
        "reinforces an active value with evidence %j",
        async ({ evidence }) => {
            const active = rowOf({ status: "active", trust: 95 })
            const em = mockEntityManager({
                query: [
                    [SELECT_FACTS_BY_KEY, [active]],
                    [UPDATE_EVIDENCE, [active]],
                    [REJECT_RETIRE_PROPOSALS, []],
                ],
            })
            const service = await build(em)
            await expect(service.propose(WS, inputOf({ evidence }))).resolves.toEqual({
                fact: factOf({ status: "active", trust: 95 }),
                outcome: "reinforced",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [WS, "f1", JSON.stringify(evidence), 95])
            if (evidence.length > 0)
                expect(em.query).toHaveBeenCalledWith(REJECT_RETIRE_PROPOSALS, [
                    WS,
                    "shop",
                    "hours",
                    null,
                    "A source confirmed this value again",
                ])
            else expect(em.query).toHaveBeenCalledTimes(2)
        },
    )

    it.each([false, true])("reinforces a waiting value with an active conflict %s", async (hasActive) => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, hasActive ? [rowOf({ id: "old", value: "9h" })] : []],
                [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" }), rowOf({ value: "10h" }), rowOf()]],
                [UPDATE_EVIDENCE, [rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.propose(WS, inputOf())).resolves.toEqual({
            fact: factOf(),
            outcome: hasActive ? "conflict" : "proposed",
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [WS, "f1", "[]", 60])
    })

    it("applies a waiting value when the trusted owner confirms it", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [SELECT_FACTS_BY_KEY, [rowOf()]],
                [UPDATE_EVIDENCE, [rowOf({ trust: 95 })]],
            ],
        })
        const service = await build(em)
        const apply = jest.spyOn(service, "apply").mockResolvedValue(factOf({ status: "active" }))
        await expect(service.propose(WS, inputOf({ sourceKind: "owner" }))).resolves.toEqual({
            fact: factOf({ status: "active" }),
            outcome: "applied",
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [WS, "f1", "[]", 95])
        expect(apply).toHaveBeenCalledWith(WS, "f1", "u1")
    })

    it("creates an ordinary proposal with defaults", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.propose(WS, inputOf())).resolves.toEqual({ fact: factOf(), outcome: "proposed" })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "business",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            null,
            "internal",
            [],
            "staff",
            60,
            null,
            null,
            null,
            "[]",
            "u1",
            null,
            "set",
        ])
    })

    it("inherits the active value's type, restricted modules and unit for a conflict", async () => {
        const active = rowOf({
            id: "old",
            value: "9h",
            subject_type: "service",
            scope: "restricted",
            modules: ["sales"],
            unit: "hour",
        })
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, [active]],
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [rowOf()]],
            ],
        })
        await expect((await build(em)).propose(WS, inputOf({ unit: " " }))).resolves.toEqual({
            fact: factOf(),
            outcome: "conflict",
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "service",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            "hour",
            "restricted",
            ["sales"],
            "staff",
            60,
            null,
            null,
            "old",
            "[]",
            "u1",
            null,
            "set",
        ])
    })

    it("honors explicit fields and auto-applies the new value", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [rowOf()]],
            ],
        })
        const service = await build(em)
        const apply = jest.spyOn(service, "apply").mockResolvedValue(factOf({ status: "active" }))
        await expect(
            service.propose(
                WS,
                inputOf({
                    subjectType: "product",
                    scope: "restricted",
                    modules: ["chatbot"],
                    unit: " hours ",
                    validFrom: AT,
                    validTo: LATER,
                    evidence: [PROOF],
                    installationId: "i1",
                    autoApply: true,
                }),
            ),
        ).resolves.toEqual({ fact: factOf({ status: "active" }), outcome: "applied" })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "product",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            "hours",
            "restricted",
            ["chatbot"],
            "staff",
            60,
            AT,
            LATER,
            null,
            JSON.stringify([PROOF]),
            "u1",
            "i1",
            "set",
        ])
        expect(apply).toHaveBeenCalledWith(WS, "f1", "u1")
    })

    it("creates a restricted proposal without modules and reports an insert that returns no fact", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, []],
            ],
        })
        await expect(
            (await build(em)).propose(WS, inputOf({ scope: "restricted", autoApply: false })),
        ).rejects.toMatchObject({ code: BrainFactsErrorCode.FactNotFound })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "business",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            null,
            "restricted",
            [],
            "staff",
            60,
            null,
            null,
            null,
            "[]",
            "u1",
            null,
            "set",
        ])
    })

    it.each([null, factOf({ status: "active" }), factOf({ proposalKind: "retire" })])(
        "guards choosing and splitting invalid proposals %j",
        async (fact) => {
            const service = await build(mockEntityManager())
            jest.spyOn(service, "get").mockResolvedValue(fact)
            const code =
                fact?.proposalKind === "retire" ? BrainFactsErrorCode.NotAValue : BrainFactsErrorCode.NotProposed
            await expect(service.choose(WS, "f1", "u2")).rejects.toMatchObject({ code })
            await expect(service.split(WS, "f1", "Weekend", "u2")).rejects.toMatchObject({ code })
        },
    )

    it.each([{ rows: [] }, { rows: [rowOf({ status: "active" })] }])(
        "rolls back approval of absent or decided facts %j",
        async ({ rows }) => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_FACT, rows] }))
            await expect((await build(tx.em)).apply(WS, "f1", "u2")).rejects.toMatchObject({
                code: rows.length === 0 ? BrainFactsErrorCode.FactNotFound : BrainFactsErrorCode.NotProposed,
            })
            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        },
    )

    it.each([false, true])("activates an approved fact with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [rowOf({ valid_from: current ? AT : null })]],
                    [SELECT_FACTS_BY_KEY, current ? [rowOf({ id: "old" })] : []],
                    [SUPERSEDE_FACT, []],
                    [ACTIVATE_FACT, [rowOf({ status: "active" })]],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(WS, "f1", "u2", current ? " approved " : " ")).resolves.toEqual(
            factOf({ status: "active" }),
        )
        expect(tx.em.query).toHaveBeenCalledWith(ACTIVATE_FACT, [
            WS,
            "f1",
            current ? "old" : null,
            "u2",
            current ? "approved" : null,
        ])
        if (current) expect(tx.em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [WS, "old"])
        else expect(tx.em.query).toHaveBeenCalledTimes(3)
        expect(tx.commits).toBe(1)
    })

    it.each([false, true])("schedules future facts with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [rowOf({ valid_from: LATER })]],
                    [SELECT_FACTS_BY_KEY, current ? [rowOf({ id: "old" })] : []],
                    [REJECT_SCHEDULED, []],
                    [END_ACTIVE_AT, []],
                    [SCHEDULE_FACT, [rowOf({ status: "scheduled" })]],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(WS, "f1", "u2")).resolves.toEqual(factOf({ status: "scheduled" }))
        expect(tx.em.query).toHaveBeenCalledWith(REJECT_SCHEDULED, [WS, "shop", "hours", null])
        expect(tx.em.query).toHaveBeenCalledWith(SCHEDULE_FACT, [WS, "f1", current ? "old" : null, "u2", null])
        if (current) expect(tx.em.query).toHaveBeenCalledWith(END_ACTIVE_AT, [WS, "old", LATER])
        else expect(tx.em.query).toHaveBeenCalledTimes(4)
    })

    it.each([undefined, " because "])("applies retirement proposals with reason %s", async (note) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [rowOf({ proposal_kind: "retire" })]],
                    [SELECT_FACTS_BY_KEY, [rowOf({ id: "old" })]],
                    [RETIRE_FACT, [rowOf({ status: "expired" })]],
                    [CLOSE_RETIRE_PROPOSAL, [rowOf({ status: "expired" })]],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(WS, "f1", "u2", note)).resolves.toEqual(factOf({ status: "expired" }))
        expect(tx.em.query).toHaveBeenCalledWith(RETIRE_FACT, [
            WS,
            "old",
            "u2",
            note === undefined ? "No source supports this value any more" : "because",
        ])
        expect(tx.em.query).toHaveBeenCalledWith(CLOSE_RETIRE_PROPOSAL, [
            WS,
            "f1",
            "u2",
            note === undefined ? "Stopped using" : "because",
        ])
    })

    it("closes a retirement proposal even when the active fact is already gone", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [rowOf({ proposal_kind: "retire" })]],
                    [SELECT_FACTS_BY_KEY, []],
                    [CLOSE_RETIRE_PROPOSAL, []],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        expect(tx.em.query).toHaveBeenCalledTimes(3)
    })

    it.each([undefined, " ", " reason "])("rejects and retires with trimmed reason %s", async (note) => {
        const em = mockEntityManager({
            query: [
                [REJECT_FACT, [rowOf({ status: "rejected" })]],
                [RETIRE_FACT, [rowOf({ status: "expired" })]],
            ],
        })
        const service = await build(em)
        await expect(service.reject(WS, "f1", "u2", note)).resolves.toEqual(factOf({ status: "rejected" }))
        await expect(service.retire(WS, "f1", "u2", note)).resolves.toEqual(factOf({ status: "expired" }))
        expect(em.query.mock.calls).toEqual([
            [REJECT_FACT, [WS, "f1", "u2", note === " reason " ? "reason" : null]],
            [RETIRE_FACT, [WS, "f1", "u2", note === " reason " ? "reason" : null]],
        ])
    })

    it("rejects writes that find no proposed or active fact", async () => {
        const service = await build(
            mockEntityManager({
                query: [
                    [REJECT_FACT, []],
                    [RETIRE_FACT, []],
                ],
            }),
        )
        await expect(service.reject(WS, "f1", "u2")).rejects.toMatchObject({ code: BrainFactsErrorCode.NotProposed })
        await expect(service.retire(WS, "f1", "u2")).rejects.toMatchObject({ code: BrainFactsErrorCode.NotActive })
    })

    it("chooses one value and rejects the other values and retirement proposals", async () => {
        const service = await build(mockEntityManager())
        jest.spyOn(service, "get").mockResolvedValue(factOf())
        const apply = jest.spyOn(service, "apply").mockResolvedValue(factOf({ status: "active" }))
        const byKey = jest
            .spyOn(service, "byKey")
            .mockResolvedValue([factOf(), factOf({ id: "f2" }), factOf({ id: "f3", proposalKind: "retire" })])
        const reject = jest.spyOn(service, "reject").mockResolvedValue(factOf({ status: "rejected" }))
        await expect(service.choose(WS, "f1", "u2")).resolves.toEqual(factOf({ status: "active" }))
        expect(apply).toHaveBeenCalledWith(WS, "f1", "u2", "Chosen among several different values")
        expect(byKey).toHaveBeenCalledWith(WS, "shop", "hours", "proposed", null)
        expect(reject.mock.calls).toEqual([
            [WS, "f2", "u2", "Another value was chosen: 8h"],
            [WS, "f3", "u2", "A new value was chosen"],
        ])
    })

    it("keeps the current value and counts rejected proposals", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, [rowOf(), rowOf({ id: "f2" })]],
                [SELECT_FACTS_BY_KEY, []],
                [REJECT_FACT, [rowOf({ status: "rejected" })]],
            ],
        })
        const service = await build(em)
        await expect(service.keepCurrent(WS, "shop", "hours", "u2", "i1")).resolves.toBe(2)
        await expect(service.keepCurrent(WS, "shop", "hours", "u2", "i1")).resolves.toBe(0)
        expect(em.query).toHaveBeenCalledWith(REJECT_FACT, [WS, "f2", "u2", "Kept the value in force"])
    })

    it("requires a situation and splits a value into its own automatically applied fact", async () => {
        const service = await build(mockEntityManager())
        jest.spyOn(service, "get").mockResolvedValue(factOf())
        const propose = jest
            .spyOn(service, "propose")
            .mockResolvedValue({ fact: factOf({ id: "new" }), outcome: "applied" })
        const reject = jest.spyOn(service, "reject").mockResolvedValue(factOf({ status: "rejected" }))
        await expect(service.split(WS, "f1", " ", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.SituationRequired,
        })
        await expect(service.split(WS, "f1", " Weekend ", "u2")).resolves.toEqual(factOf({ id: "new" }))
        expect(propose).toHaveBeenCalledWith(WS, {
            subjectType: "business",
            subjectLabel: "Shop",
            attributeLabel: "Hours (Weekend)",
            value: "8h",
            unit: null,
            scope: "internal",
            modules: [],
            sourceKind: "staff",
            validFrom: null,
            validTo: null,
            evidence: [],
            proposedBy: "u1",
            installationId: null,
            autoApply: true,
        })
        expect(reject).toHaveBeenCalledWith(WS, "f1", "u2", "Split into its own fact: Hours (Weekend)")
    })

    it("files a retirement only once and retains the complete active value", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, [rowOf()]],
                [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" })]],
                [INSERT_FACT, []],
            ],
        })
        const service = await build(em)
        const active = factOf({ status: "active", installationId: "i1", modules: ["sales"] })
        await expect(service.proposeRetire(WS, active, PROOF, "u2")).resolves.toBe(true)
        await expect(service.proposeRetire(WS, active, PROOF, "u2")).resolves.toBe(false)
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "business",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            null,
            "internal",
            ["sales"],
            "document",
            75,
            null,
            null,
            "f1",
            JSON.stringify([PROOF]),
            "u2",
            "i1",
            "retire",
        ])
        expect(em.query).toHaveBeenCalledTimes(3)
    })

    it("withdraws document evidence, rejects unsupported proposals and returns document orphans", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_FACTS_OF_DOCUMENT,
                    [
                        rowOf({ evidence: [PROOF] }),
                        rowOf({ id: "orphan", status: "active", source_kind: "document", evidence: [PROOF] }),
                        rowOf({ id: "owner", status: "active", source_kind: "owner", evidence: [PROOF] }),
                        rowOf({ id: "scheduled", status: "scheduled", evidence: [PROOF] }),
                        rowOf({
                            id: "supported",
                            status: "active",
                            evidence: [PROOF, OTHER, { ...PROOF, ref: "doc-2" }],
                        }),
                    ],
                ],
                [REJECT_FACT, [rowOf({ status: "rejected" })]],
                [UPDATE_EVIDENCE_ONLY, []],
            ],
        })
        await expect((await build(em)).withdrawSource(WS, "doc-1", "Removed")).resolves.toEqual(["orphan"])
        expect(em.query).toHaveBeenCalledWith(SELECT_FACTS_OF_DOCUMENT, [WS, '[{"kind":"document","ref":"doc-1"}]'])
        expect(em.query).toHaveBeenCalledWith(REJECT_FACT, [WS, "f1", "NIVO", "Removed"])
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE_ONLY, [
            WS,
            "supported",
            JSON.stringify([OTHER, { ...PROOF, ref: "doc-2" }]),
        ])
        expect(em.query).toHaveBeenCalledTimes(6)
    })

    it("only finalizes still unsupported active facts without a waiting value", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACT, []],
                [SELECT_FACT, [rowOf()]],
                [SELECT_FACT, [rowOf({ status: "active", evidence: [PROOF] })]],
                [SELECT_FACT, [rowOf({ status: "active", id: "value" })]],
                [SELECT_FACT, [rowOf({ status: "active", id: "retire" })]],
                [SELECT_FACT, [rowOf({ status: "active", id: "file" })]],
                [SELECT_FACTS_BY_KEY, [rowOf()]],
                [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" })]],
                [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" })]],
                [SELECT_FACTS_BY_KEY, []],
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, []],
            ],
        })
        await expect(
            (await build(em)).finalizeOrphans(
                WS,
                ["missing", "proposed", "supported", "value", "retire", "file"],
                PROOF,
            ),
        ).resolves.toBe(1)
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, [
            WS,
            "business",
            "shop",
            "Shop",
            "hours",
            "Hours",
            "8h",
            8,
            null,
            "internal",
            [],
            "document",
            75,
            null,
            null,
            "file",
            JSON.stringify([PROOF]),
            "NIVO",
            null,
            "retire",
        ])
    })

    it("promotes due facts, supersedes every former value and counts expirations", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_DUE_FACTS, [rowOf(), rowOf({ id: "f2" })]],
                [SELECT_FACTS_BY_KEY, [rowOf({ id: "old1" }), rowOf({ id: "old2" })]],
                [SELECT_FACTS_BY_KEY, []],
                [SUPERSEDE_FACT, []],
                [PROMOTE_FACT, [rowOf({ status: "active" })]],
                [PROMOTE_FACT, []],
                [EXPIRE_DUE_FACTS, [{ id: "e1" }, { id: "e2" }]],
            ],
        })
        await expect((await build(em)).maintain(WS)).resolves.toEqual({
            activated: [factOf({ status: "active" })],
            expired: 2,
        })
        expect(em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [WS, "old1"])
        expect(em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [WS, "old2"])
        expect(em.query).toHaveBeenCalledWith(PROMOTE_FACT, [WS, "f2"])
        expect(em.query).toHaveBeenCalledWith(EXPIRE_DUE_FACTS, [WS])
    })
})

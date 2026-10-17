import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainFactsService } from "./brain-facts.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import {
    ACTIVATE_FACT,
    END_ACTIVE_AT,
    INSERT_FACT,
    REJECT_RETIRE_PROPOSALS,
    REJECT_SCHEDULED,
    SCHEDULE_FACT,
    SELECT_FACT,
    SELECT_FACTS,
    SELECT_FACTS_BY_KEY,
    SUPERSEDE_FACT,
    UPDATE_EVIDENCE,
} from "./persistence/brain-facts.sql"
import {
    CLOSE_RETIRE_PROPOSAL,
    EXPIRE_DUE_FACTS,
    PROMOTE_FACT,
    REJECT_FACT,
    RETIRE_FACT,
    SELECT_FACTS_OF_DOCUMENT,
    UPDATE_EVIDENCE_ONLY,
} from "./persistence/brain-facts.sql"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsService)
}

describe("BrainFactsService", () => {
    it("reads a fact or null and keys its queries by workspace and installation", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACT, [facts.rowOf()]],
                [SELECT_FACT, []],
                [SELECT_FACTS_BY_KEY, [facts.rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.get(facts.WS, "f1")).resolves.toEqual(facts.factOf())
        await expect(service.get(facts.WS, "absent")).resolves.toBeNull()
        await expect(service.byKey(facts.WS, "shop", "hours", "proposed", "i1")).resolves.toEqual([facts.factOf()])
        expect(em.query.mock.calls).toEqual([
            [SELECT_FACT, [facts.WS, "f1"]],
            [SELECT_FACT, [facts.WS, "absent"]],
            [SELECT_FACTS_BY_KEY, [facts.WS, "shop", "hours", "proposed", "i1"]],
        ])
    })

    it("lists with defaults or explicit filters and bounds the result count", async () => {
        const em = mockEntityManager({ query: [SELECT_FACTS, [facts.rowOf()]] })
        const service = await build(em)
        await expect(service.list(facts.WS, {})).resolves.toEqual([facts.factOf()])
        await expect(
            service.list(facts.WS, { statuses: ["proposed"], subjectKey: "shop", limit: 3000 }),
        ).resolves.toEqual([facts.factOf()])
        expect(em.query.mock.calls).toEqual([
            [SELECT_FACTS, [facts.WS, null, null, 500]],
            [SELECT_FACTS, [facts.WS, ["proposed"], "shop", 2000]],
        ])
    })

    it("filters active facts by the current instant and audience", async () => {
        const em = mockEntityManager(facts.viewStubs())
        const service = await build(em)
        await expect(service.forView(facts.WS, "customer", "sales", null, 7)).resolves.toEqual([
            facts.factOf({ scope: "public", status: "active" }),
        ])
        expect(em.query).toHaveBeenCalledWith(SELECT_FACTS, [facts.WS, ["active"], null, 7])
    })

    it("searches a view of at most 500 active facts", async () => {
        const service = await build(mockEntityManager())
        const view = jest.spyOn(service, "forView").mockResolvedValue([facts.factOf()])
        await expect(service.search(facts.WS, "internal", "sales", "i1", "shop", 1)).resolves.toEqual([facts.factOf()])
        expect(view).toHaveBeenCalledWith(facts.WS, "internal", "sales", "i1", 500)
    })

    it("rejects incomplete facts before reaching persistence", async () => {
        const em = mockEntityManager()
        await expect((await build(em)).propose(facts.WS, facts.inputOf({ value: " " }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("BrainFactsService", () => {
    it.each([{ evidence: [] }, { evidence: [facts.PROOF] }])(
        "reinforces an active value with evidence %j",
        async ({ evidence }) => {
            const active = facts.rowOf({ status: "active", trust: 95 })
            const em = mockEntityManager({
                query: [
                    [SELECT_FACTS_BY_KEY, [active]],
                    [UPDATE_EVIDENCE, [active]],
                    [REJECT_RETIRE_PROPOSALS, []],
                ],
            })
            const service = await build(em)
            await expect(service.propose(facts.WS, facts.inputOf({ evidence }))).resolves.toEqual({
                fact: facts.factOf({ status: "active", trust: 95 }),
                outcome: "reinforced",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [facts.WS, "f1", JSON.stringify(evidence), 95])
            if (evidence.length > 0)
                expect(em.query).toHaveBeenCalledWith(REJECT_RETIRE_PROPOSALS, facts.confirmedValue)
            else expect(em.query).toHaveBeenCalledTimes(2)
        },
    )

    it.each([false, true])("reinforces a waiting value with an active conflict %s", async (hasActive) => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, hasActive ? [facts.rowOf({ id: "old", value: "9h" })] : []],
                [
                    SELECT_FACTS_BY_KEY,
                    [facts.rowOf({ proposal_kind: "retire" }), facts.rowOf({ value: "10h" }), facts.rowOf()],
                ],
                [UPDATE_EVIDENCE, [facts.rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toEqual({
            fact: facts.factOf(),
            outcome: hasActive ? "conflict" : "proposed",
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [facts.WS, "f1", "[]", 60])
    })

    it("applies a waiting value when the trusted owner confirms it", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [SELECT_FACTS_BY_KEY, [facts.rowOf()]],
                [UPDATE_EVIDENCE, [facts.rowOf({ trust: 95 })]],
            ],
        })
        const service = await build(em)
        const apply = jest.spyOn(service, "apply").mockResolvedValue(facts.factOf({ status: "active" }))
        await expect(service.propose(facts.WS, facts.inputOf({ sourceKind: "owner" }))).resolves.toEqual({
            fact: facts.factOf({ status: "active" }),
            outcome: "applied",
        })
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE, [facts.WS, "f1", "[]", 95])
        expect(apply).toHaveBeenCalledWith(facts.WS, "f1", "u1")
    })
})

describe("BrainFactsService", () => {
    it("creates an ordinary proposal with defaults", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [facts.rowOf()]],
            ],
        })
        const service = await build(em)
        await expect(service.propose(facts.WS, facts.inputOf())).resolves.toEqual({
            fact: facts.factOf(),
            outcome: "proposed",
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.ordinaryInsert)
    })
})

describe("BrainFactsService", () => {
    it("inherits the active value's type, restricted modules and unit for a conflict", async () => {
        const active = facts.conflictingActive
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, [active]],
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [facts.rowOf()]],
            ],
        })
        await expect((await build(em)).propose(facts.WS, facts.inputOf({ unit: " " }))).resolves.toEqual({
            fact: facts.factOf(),
            outcome: "conflict",
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.conflictInsert)
    })
})

describe("BrainFactsService", () => {
    it("honors explicit fields and auto-applies the new value", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, [facts.rowOf()]],
            ],
        })
        const service = await build(em)
        const apply = jest.spyOn(service, "apply").mockResolvedValue(facts.factOf({ status: "active" }))
        await expect(service.propose(facts.WS, facts.inputOf(facts.explicitInput))).resolves.toEqual({
            fact: facts.factOf({ status: "active" }),
            outcome: "applied",
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.explicitInsert)
        expect(apply).toHaveBeenCalledWith(facts.WS, "f1", "u1")
    })
})

describe("BrainFactsService", () => {
    it("creates a restricted proposal without modules and reports an insert that returns no fact", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, []],
                [INSERT_FACT, []],
            ],
        })
        await expect(
            (await build(em)).propose(facts.WS, facts.inputOf({ scope: "restricted", autoApply: false })),
        ).rejects.toMatchObject({ code: BrainFactsErrorCode.FactNotFound })
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.restrictedInsert)
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

    it.each([{ rows: [] }, { rows: [facts.rowOf({ status: "active" })] }])(
        "rolls back approval of absent or decided facts %j",
        async ({ rows }) => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_FACT, rows] }))
            await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).rejects.toMatchObject({
                code: rows.length === 0 ? BrainFactsErrorCode.FactNotFound : BrainFactsErrorCode.NotProposed,
            })
            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        },
    )
})

describe("BrainFactsService", () => {
    it.each([false, true])("activates an approved fact with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [facts.rowOf({ valid_from: current ? facts.AT : null })]],
                    [SELECT_FACTS_BY_KEY, current ? [facts.rowOf({ id: "old" })] : []],
                    [SUPERSEDE_FACT, []],
                    [ACTIVATE_FACT, [facts.rowOf({ status: "active" })]],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2", current ? " approved " : " ")).resolves.toEqual(
            facts.factOf({ status: "active" }),
        )
        expect(tx.em.query).toHaveBeenCalledWith(ACTIVATE_FACT, [
            facts.WS,
            "f1",
            current ? "old" : null,
            "u2",
            current ? "approved" : null,
        ])
        if (current) expect(tx.em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [facts.WS, "old"])
        else expect(tx.em.query).toHaveBeenCalledTimes(3)
        expect(tx.commits).toBe(1)
    })

    it.each([false, true])("schedules future facts with an existing active fact %s", async (current) => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [facts.rowOf({ valid_from: facts.LATER })]],
                    [SELECT_FACTS_BY_KEY, current ? [facts.rowOf({ id: "old" })] : []],
                    [REJECT_SCHEDULED, []],
                    [END_ACTIVE_AT, []],
                    [SCHEDULE_FACT, [facts.rowOf({ status: "scheduled" })]],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).resolves.toEqual(
            facts.factOf({ status: "scheduled" }),
        )
        expect(tx.em.query).toHaveBeenCalledWith(REJECT_SCHEDULED, [facts.WS, "shop", "hours", null])
        expect(tx.em.query).toHaveBeenCalledWith(SCHEDULE_FACT, [facts.WS, "f1", current ? "old" : null, "u2", null])
        if (current) expect(tx.em.query).toHaveBeenCalledWith(END_ACTIVE_AT, [facts.WS, "old", facts.LATER])
        else expect(tx.em.query).toHaveBeenCalledTimes(4)
    })
})

describe("BrainFactsService", () => {
    it.each([undefined, " because "])("applies retirement proposals with reason %s", async (note) => {
        const tx = fakeTransaction(mockEntityManager(facts.retirementStubs()))
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2", note)).resolves.toEqual(
            facts.factOf({ status: "expired" }),
        )
        expect(tx.em.query).toHaveBeenCalledWith(RETIRE_FACT, [
            facts.WS,
            "old",
            "u2",
            note === undefined ? "No source supports this value any more" : "because",
        ])
        expect(tx.em.query).toHaveBeenCalledWith(CLOSE_RETIRE_PROPOSAL, [
            facts.WS,
            "f1",
            "u2",
            note === undefined ? "Stopped using" : "because",
        ])
    })

    it("closes a retirement proposal even when the active fact is already gone", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_FACT, [facts.rowOf({ proposal_kind: "retire" })]],
                    [SELECT_FACTS_BY_KEY, []],
                    [CLOSE_RETIRE_PROPOSAL, []],
                ],
            }),
        )
        await expect((await build(tx.em)).apply(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        expect(tx.em.query).toHaveBeenCalledTimes(3)
    })

    it.each([undefined, " ", " reason "])("rejects and retires with trimmed reason %s", async (note) => {
        const em = mockEntityManager({
            query: [
                [REJECT_FACT, [facts.rowOf({ status: "rejected" })]],
                [RETIRE_FACT, [facts.rowOf({ status: "expired" })]],
            ],
        })
        const service = await build(em)
        await expect(service.reject(facts.WS, "f1", "u2", note)).resolves.toEqual(facts.factOf({ status: "rejected" }))
        await expect(service.retire(facts.WS, "f1", "u2", note)).resolves.toEqual(facts.factOf({ status: "expired" }))
        expect(em.query.mock.calls).toEqual([
            [REJECT_FACT, [facts.WS, "f1", "u2", note === " reason " ? "reason" : null]],
            [RETIRE_FACT, [facts.WS, "f1", "u2", note === " reason " ? "reason" : null]],
        ])
    })
})

describe("BrainFactsService", () => {
    it("rejects writes that find no proposed or active fact", async () => {
        const service = await build(
            mockEntityManager({
                query: [
                    [REJECT_FACT, []],
                    [RETIRE_FACT, []],
                ],
            }),
        )
        await expect(service.reject(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        await expect(service.retire(facts.WS, "f1", "u2")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotActive,
        })
    })

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
            query: [
                [SELECT_FACTS_BY_KEY, [facts.rowOf(), facts.rowOf({ id: "f2" })]],
                [SELECT_FACTS_BY_KEY, []],
                [REJECT_FACT, [facts.rowOf({ status: "rejected" })]],
            ],
        })
        const service = await build(em)
        await expect(service.keepCurrent(facts.WS, "shop", "hours", "u2", "i1")).resolves.toBe(2)
        await expect(service.keepCurrent(facts.WS, "shop", "hours", "u2", "i1")).resolves.toBe(0)
        expect(em.query).toHaveBeenCalledWith(REJECT_FACT, [facts.WS, "f2", "u2", "Kept the value in force"])
    })
})

describe("BrainFactsService", () => {
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
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_BY_KEY, [facts.rowOf()]],
                [SELECT_FACTS_BY_KEY, [facts.rowOf({ proposal_kind: "retire" })]],
                [INSERT_FACT, []],
            ],
        })
        const service = await build(em)
        const active = facts.factOf({ status: "active", installationId: "i1", modules: ["sales"] })
        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(true)
        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(false)
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.retirementInsert)
        expect(em.query).toHaveBeenCalledTimes(3)
    })
})

describe("BrainFactsService", () => {
    it("withdraws document evidence, rejects unsupported proposals and returns document orphans", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FACTS_OF_DOCUMENT, facts.withdrawalRows],
                [REJECT_FACT, [facts.rowOf({ status: "rejected" })]],
                [UPDATE_EVIDENCE_ONLY, []],
            ],
        })
        await expect((await build(em)).withdrawSource(facts.WS, "doc-1", "Removed")).resolves.toEqual(["orphan"])
        expect(em.query).toHaveBeenCalledWith(SELECT_FACTS_OF_DOCUMENT, [
            facts.WS,
            '[{"kind":"document","ref":"doc-1"}]',
        ])
        expect(em.query).toHaveBeenCalledWith(REJECT_FACT, [facts.WS, "f1", "NIVO", "Removed"])
        expect(em.query).toHaveBeenCalledWith(UPDATE_EVIDENCE_ONLY, [
            facts.WS,
            "supported",
            JSON.stringify([facts.OTHER, { ...facts.PROOF, ref: "doc-2" }]),
        ])
        expect(em.query).toHaveBeenCalledTimes(6)
    })
})

describe("BrainFactsService", () => {
    it("only finalizes still unsupported active facts without a waiting value", async () => {
        const em = mockEntityManager(facts.orphanStubs())
        await expect(
            (await build(em)).finalizeOrphans(
                facts.WS,
                ["missing", "proposed", "supported", "value", "retire", "file"],
                facts.PROOF,
            ),
        ).resolves.toBe(1)
        expect(em.query).toHaveBeenCalledWith(INSERT_FACT, facts.orphanInsert)
    })
})

describe("BrainFactsService", () => {
    it("promotes due facts, supersedes every former value and counts expirations", async () => {
        const em = mockEntityManager(facts.maintenanceStubs())
        await expect((await build(em)).maintain(facts.WS)).resolves.toEqual({
            activated: [facts.factOf({ status: "active" })],
            expired: 2,
        })
        expect(em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [facts.WS, "old1"])
        expect(em.query).toHaveBeenCalledWith(SUPERSEDE_FACT, [facts.WS, "old2"])
        expect(em.query).toHaveBeenCalledWith(PROMOTE_FACT, [facts.WS, "f2"])
        expect(em.query).toHaveBeenCalledWith(EXPIRE_DUE_FACTS, [facts.WS])
    })
})

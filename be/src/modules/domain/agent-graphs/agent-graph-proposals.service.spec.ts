import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { OWNER_EXAMPLE, ROW_TIME, graphOf, proposalRow } from "@tests/fixtures/builders/agent-graph.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import type { IntentBusiness, IntentGap } from "@modules/domain/intent-contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { ClosedDecision } from "./agent-graphs.contracts"
import { AgentGraphProposalEntity } from "./persistence/entities"

const GRAPH = graphOf(OWNER_EXAMPLE)

const approvals = (count: number, branchKey = "middle"): Array<ClosedDecision> =>
    Array.from({ length: count }, (_unused, index): ClosedDecision => ({
        id: `d${index}`,
        branchKey,
        closedAs: "approved",
        amount: 6_000_000,
    }))

const build = async (closed: ReadonlyArray<ClosedDecision>, em = mockEntityManager()) => {
    const decisions = mock<AgentGraphDecisionsService>({ closedOf: jest.fn().mockResolvedValue(closed) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphProposalsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T02:00:00.000Z") },
            { provide: AgentGraphDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphProposalsService), decisions, em }
}

const inserted = (written: boolean): QueryBuilderAnswers => ({
    execute: { identifiers: written ? [{ id: "p1" }] : [], raw: [] },
})

describe("AgentGraphProposalsService.learn", () => {
    it("raises a proposal for the signal the decisions teach, with the decisions as evidence, and changes no version", async () => {
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, []] })
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service, decisions } = await build(approvals(20), em)

        await expect(service.learn("ws-1", "agent-1", "version-1", GRAPH)).resolves.toBe(1)

        expect(decisions.closedOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            workspaceId: "ws-1",
            agentId: "agent-1",
            dedupeKey: "learned:trust:middle:d0",
            kind: "learned",
            baseVersionId: "version-1",
            nodeKey: "decide",
            branchKey: "middle",
            patch: { signal: "trust", amounts: approvals(20).map((entry) => entry.amount) },
            widens: true,
        })
        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ evidence: approvals(20).map((entry) => entry.id) })
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("counts only the proposals that were new, and none for an agent that taught nothing", async () => {
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, []] })
        queueQueryBuilders(em, [inserted(false)])
        const known = await build(approvals(20), em)
        const quiet = await build(approvals(3), mockEntityManager({ find: [AgentGraphProposalEntity, []] }))

        await expect(known.service.learn("ws-1", "agent-1", null, GRAPH)).resolves.toBe(0)
        await expect(quiet.service.learn("ws-1", "agent-1", null, GRAPH)).resolves.toBe(0)
    })

    it("names no node for a branch the graph no longer has", async () => {
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, []] })
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service } = await build(approvals(20, "gone"), em)

        await service.learn("ws-1", "agent-1", null, GRAPH)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ nodeKey: null, branchKey: "gone", baseVersionId: null })
    })
})

describe("AgentGraphProposalsService.learn a window already spent", () => {
    const spentBy = (status: "declined" | "confirmed" | "open", signal: string, branchKey: string) =>
        Object.assign(proposalRow(), {
            status,
            branchKey,
            patch: { signal },
            evidence: approvals(20).map((entry) => entry.id),
        })

    it.each([["declined" as const], ["confirmed" as const], ["open" as const]])(
        "does not raise again what a %s proposal already named for the same branch and signal",
        async (status) => {
            const em = mockEntityManager({ find: [AgentGraphProposalEntity, [spentBy(status, "trust", "middle")]] })
            queueQueryBuilders(em, [inserted(true)])
            const { service } = await build(approvals(20), em)

            await expect(service.learn("ws-1", "agent-1", "version-1", GRAPH)).resolves.toBe(0)
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        },
    )

    it("raises it for another branch or another signal, and for decisions the proposal did not name", async () => {
        const em = mockEntityManager({
            find: [
                AgentGraphProposalEntity,
                [spentBy("declined", "reject", "middle"), spentBy("declined", "trust", "small")],
            ],
        })
        queueQueryBuilders(em, [inserted(true)])
        const { service } = await build(approvals(20), em)

        await expect(service.learn("ws-1", "agent-1", "version-1", GRAPH)).resolves.toBe(1)
    })

    it("reads a branch with no key as an empty one, so a proposal about nothing blocks nothing", async () => {
        const loose = Object.assign(spentBy("declined", "trust", "middle"), { branchKey: null })
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, [loose]] })
        queueQueryBuilders(em, [inserted(true)])
        const { service } = await build(approvals(20), em)

        await expect(service.learn("ws-1", "agent-1", "version-1", GRAPH)).resolves.toBe(1)
    })
})

describe("AgentGraphProposalsService.raiseConflict", () => {
    const conflict = {
        nodeKey: "decide",
        branchKey: "middle",
        oldFactId: "fact-1",
        newFactId: "fact-2",
        newValueHash: "hash-2",
        dedupeKey: "conflict:decide:fact-2",
    }

    it("raises one conflict for a replaced rule, holding both facts and the new hash, and never a widening", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service } = await build([], em)

        await expect(service.raiseConflict("ws-1", "agent-1", "version-1", conflict)).resolves.toBe(true)

        expect(fake?.callsOf("values")[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            dedupeKey: "conflict:decide:fact-2",
            kind: "conflict",
            baseVersionId: "version-1",
            nodeKey: "decide",
            branchKey: "middle",
            patch: { oldFactId: "fact-1", newFactId: "fact-2", newValueHash: "hash-2" },
            widens: false,
            evidence: ["fact-1", "fact-2"],
        })
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("keeps no branch for a rule behind a whole node, and raises nothing a second time", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(false)])
        const { service } = await build([], em)

        await expect(
            service.raiseConflict("ws-1", "agent-1", "version-1", { ...conflict, branchKey: "" }),
        ).resolves.toBe(false)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ branchKey: null })
    })
})

describe("AgentGraphProposalsService.openOf", () => {
    it("lists the proposals still open, newest first", async () => {
        const row = Object.assign(proposalRow(), { patch: {} })
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, [row]] })
        const { service } = await build([], em)

        await expect(service.openOf("ws-1", "agent-1")).resolves.toEqual([
            {
                id: "p1",
                kind: "learned",
                status: "open",
                nodeKey: "decide",
                branchKey: "middle",
                widens: true,
                evidence: ["d0"],
                createdAt: ROW_TIME.toISOString(),
                intent: null,
                text: null,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", agentId: "agent-1", status: "open" } }),
        )
    })
})

describe("AgentGraphProposalsService the road to a confirmed change", () => {
    it("reads an open learned proposal as the patch it makes", async () => {
        const row = Object.assign(proposalRow(), { patch: { signal: "trust", amounts: [6_000_000, "x", 7_200_000] } })
        const em = mockEntityManager({ findOne: [AgentGraphProposalEntity, row] })
        const { service } = await build([], em)

        await expect(service.learnedOf("ws-1", "agent-1", "p1")).resolves.toEqual({
            signal: "trust",
            branchKey: "middle",
            amounts: [6_000_000, 7_200_000],
        })
        expect(em.findOne).toHaveBeenCalledWith(AgentGraphProposalEntity, {
            where: { id: "p1", workspaceId: "ws-1", agentId: "agent-1", status: "open", kind: "learned" },
        })
    })

    it("reads a patch without amounts as one with none, and refuses what is not open, not a signal or has no branch", async () => {
        const bare = Object.assign(proposalRow(), { patch: { signal: "timeout" } })
        const odd = Object.assign(proposalRow(), { patch: { signal: "dance" } })
        const loose = Object.assign(proposalRow(), { patch: { signal: "trust" }, branchKey: null })

        await expect(
            (await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, bare] }))).service.learnedOf(
                "ws-1",
                "agent-1",
                "p1",
            ),
        ).resolves.toEqual({ signal: "timeout", branchKey: "middle", amounts: [] })
        await expect(
            (await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, odd] }))).service.learnedOf(
                "ws-1",
                "agent-1",
                "p1",
            ),
        ).resolves.toBeNull()
        await expect(
            (await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, loose] }))).service.learnedOf(
                "ws-1",
                "agent-1",
                "p1",
            ),
        ).resolves.toBeNull()
        await expect(
            (await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, null] }))).service.learnedOf(
                "ws-1",
                "agent-1",
                "p1",
            ),
        ).resolves.toBeNull()
    })
})

describe("AgentGraphProposalsService the road to a confirmed change (continued)", () => {
    it("keeps who confirmed a proposal, when, and the version it made", async () => {
        const em = mockEntityManager({ update: [AgentGraphProposalEntity, { affected: 1 }] })
        const { service } = await build([], em)

        await service.confirm("ws-1", "agent-1", "p1", "member-1", "version-3")

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            { id: "p1", workspaceId: "ws-1", agentId: "agent-1", status: "open" },
            {
                status: "confirmed",
                decidedBy: "member-1",
                decidedAt: new Date("2026-11-01T02:00:00.000Z"),
                resultVersionId: "version-3",
            },
        )
    })

    it("marks a proposal overtaken when its change no longer applies", async () => {
        const em = mockEntityManager({ update: [AgentGraphProposalEntity, { affected: 1 }] })
        const { service } = await build([], em)

        await service.supersede("ws-1", "agent-1", "p1")

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            { id: "p1", workspaceId: "ws-1", agentId: "agent-1", status: "open" },
            { status: "superseded" },
        )
    })
})

describe("AgentGraphProposalsService.decline", () => {
    it("records who declined an open proposal and when", async () => {
        const em = mockEntityManager({ update: [AgentGraphProposalEntity, { affected: 1 }] })
        const { service } = await build([], em)

        await expect(service.decline("ws-1", "agent-1", "p1", "member-1")).resolves.toBeUndefined()

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            { id: "p1", workspaceId: "ws-1", agentId: "agent-1", status: "open" },
            { status: "declined", decidedBy: "member-1", decidedAt: new Date("2026-11-01T02:00:00.000Z") },
        )
    })

    it("refuses a proposal that is not open or not the agent", async () => {
        const em = mockEntityManager({ update: [AgentGraphProposalEntity, { affected: 0 }] })
        const { service } = await build([], em)

        await expect(service.decline("ws-1", "agent-1", "p9", "member-1")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )
        await expect(service.decline("ws-1", "agent-1", "p9", "member-1")).rejects.toBeInstanceOf(AgentGraphsError)
    })
})

describe("AgentGraphProposalsService.raiseGap", () => {
    const gap: IntentGap = {
        workspaceId: "ws-1",
        agentId: "agent-1",
        versionId: "version-1",
        trigger: "customer_message",
        question: "Do you ship to Hue?",
        topic: "Shipping",
    }

    it("raises the gap once per question, informational and never a widening", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(true), inserted(false)])
        const { service } = await build([], em)

        await expect(service.raiseGap(gap)).resolves.toBe(true)

        expect(fake?.callsOf("values")[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            dedupeKey: "gap:do you ship to hue",
            kind: "gap",
            baseVersionId: "version-1",
            nodeKey: null,
            branchKey: null,
            patch: { question: "Do you ship to Hue?", topic: "Shipping", trigger: "customer_message" },
            widens: false,
            evidence: [],
        })
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("raises nothing a second time for the same question worded another way", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(false)])
        const { service } = await build([], em)

        await expect(service.raiseGap({ ...gap, question: "  DO YOU SHIP TO HUE " })).resolves.toBe(false)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ dedupeKey: "gap:do you ship to hue" })
    })

    it("lists a gap with its question as the text", async () => {
        const row = Object.assign(proposalRow(), { kind: "gap", patch: { question: "Do you ship to Hue?" } })
        const { service } = await build([], mockEntityManager({ find: [AgentGraphProposalEntity, [row]] }))

        await expect(service.openOf("ws-1", "agent-1")).resolves.toMatchObject([
            { kind: "gap", intent: null, text: "Do you ship to Hue?" },
        ])
    })
})

describe("AgentGraphProposalsService the contracts", () => {
    const business: IntentBusiness = {
        intent: "reply_customer",
        task: "A deposit comes first.",
        limits: [
            {
                text: "Deposit is 30%.",
                triggers: [],
                audiences: ["customer"],
                sources: [{ kind: "brain", factId: "fact-9", passage: "Deposit 30%", valueHash: "h" }],
            },
        ],
        sources: [],
    }

    it("raises the contract for the owner to approve, with the facts it cites as evidence, once per content", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service } = await build([], em)

        await expect(service.raiseContract("ws-1", "agent-1", "version-1", business, ["fact-9"])).resolves.toBe(true)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            kind: "contract",
            baseVersionId: "version-1",
            patch: { intent: "reply_customer", task: "A deposit comes first.", contract: business },
            widens: false,
            evidence: ["fact-9"],
        })
        expect(JSON.stringify(fake?.callsOf("values")[0]?.[0])).toMatch(
            /"dedupeKey":"contract:reply_customer:[0-9a-f]{64}"/u,
        )
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("lists a contract with its intent and task", async () => {
        const row = Object.assign(proposalRow(), {
            kind: "contract",
            patch: { intent: "reply_customer", task: "A deposit comes first." },
        })
        const { service } = await build([], mockEntityManager({ find: [AgentGraphProposalEntity, [row]] }))

        await expect(service.openOf("ws-1", "agent-1")).resolves.toMatchObject([
            { kind: "contract", intent: "reply_customer", text: "A deposit comes first." },
        ])
    })
})

describe("AgentGraphProposalsService the contracts to confirm", () => {
    const business: IntentBusiness = {
        intent: "reply_customer",
        task: "A deposit comes first.",
        limits: [],
        sources: [],
    }

    it("reads an open contract proposal as the business half it sets, and nothing from one that is not", async () => {
        const row = Object.assign(proposalRow(), { kind: "contract", patch: { contract: business } })
        const open = await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, row] }))
        const em = mockEntityManager({ findOne: [AgentGraphProposalEntity, null] })
        const closed = await build([], em)
        const broken = await build(
            [],
            mockEntityManager({
                findOne: [
                    AgentGraphProposalEntity,
                    Object.assign(proposalRow(), { kind: "contract", patch: { contract: { intent: 3 } } }),
                ],
            }),
        )

        await expect(open.service.contractOf("ws-1", "agent-1", "p1")).resolves.toEqual(business)
        await expect(closed.service.contractOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
        await expect(broken.service.contractOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(AgentGraphProposalEntity, {
            where: { id: "p1", workspaceId: "ws-1", agentId: "agent-1", status: "open", kind: "contract" },
        })
    })

    it("turns an open gap into a contract proposal and overtakes the gap", async () => {
        const gap = Object.assign(proposalRow(), { id: "gap-1", kind: "gap", baseVersionId: "version-1" })
        const em = mockEntityManager({
            findOne: [AgentGraphProposalEntity, gap],
            update: [AgentGraphProposalEntity, { affected: 1 }],
        })
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service } = await build([], em)

        await expect(service.contractFromGap("ws-1", "agent-1", "gap-1", business)).resolves.toBe(true)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            kind: "contract",
            evidence: ["gap-1"],
            baseVersionId: "version-1",
        })
        expect(em.update).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            { id: "gap-1", workspaceId: "ws-1", agentId: "agent-1", status: "open" },
            { status: "superseded" },
        )
    })

    it("refuses to turn into a contract a gap that is not open", async () => {
        const { service } = await build([], mockEntityManager({ findOne: [AgentGraphProposalEntity, null] }))

        await expect(service.contractFromGap("ws-1", "agent-1", "gap-1", business)).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )
    })
})

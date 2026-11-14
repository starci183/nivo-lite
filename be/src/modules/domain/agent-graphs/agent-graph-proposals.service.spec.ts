import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { ROW_TIME, proposalRow } from "@tests/fixtures/builders/agent-graph.builder"
import { SCOPE, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { GRAPH_CONFLICT_CASES } from "@tests/fixtures/builders/agent-graph-coverage.builder"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import type { IntentBusiness, IntentGap } from "@modules/domain/intent-contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const DECIDED_AT = "2026-11-01T02:00:00.000Z"

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentGraphRecordsService>()
    records.raiseProposal.mockResolvedValue(true)
    records.patchProposal.mockResolvedValue(proposalRow())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphProposalsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentGraphRecordsService, useValue: records },
            { provide: CLOCK, useValue: new FakeClock(DECIDED_AT) },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphProposalsService), records }
}

const raisedValues = (records: ReturnType<typeof mock<AgentGraphRecordsService>>) =>
    records.raiseProposal.mock.calls.at(-1)?.[1]

describe("AgentGraphProposalsService.conflictOf", () => {
    it.each(GRAPH_CONFLICT_CASES)("reads only the complete string-valued conflict patch", async (row, expected) => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(row)

        await expect(service.conflictOf("ws-1", "agent-1", "p1")).resolves.toEqual(expected)
        expect(records.proposal).toHaveBeenCalledWith(SCOPE, "p1")
    })

    it("reads nothing from a proposal that is another kind, another agent's or no longer open", async () => {
        const { service, records } = await build()
        records.proposal
            .mockResolvedValueOnce(proposalRow({ kind: "learned" }))
            .mockResolvedValueOnce(proposalRow({ kind: "conflict", agentId: "agent-2" }))
            .mockResolvedValueOnce(proposalRow({ kind: "conflict", status: "declined" }))

        await expect(service.conflictOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
        await expect(service.conflictOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
        await expect(service.conflictOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
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
        const { service, records } = await build()

        await expect(service.raiseConflict("ws-1", "agent-1", "version-1", conflict)).resolves.toBe(true)

        expect(raisedValues(records)).toEqual({
            agentId: "agent-1",
            dedupeKey: "conflict:decide:fact-2",
            kind: "conflict",
            baseVersionId: "version-1",
            nodeKey: "decide",
            branchKey: "middle",
            patch: { oldFactId: "fact-1", newFactId: "fact-2", newValueHash: "hash-2" },
            widens: false,
            evidence: { ids: ["fact-1", "fact-2"] },
        })
    })

    it("keeps no branch for a rule behind a whole node, and raises nothing a second time", async () => {
        const { service, records } = await build()
        records.raiseProposal.mockResolvedValue(false)

        await expect(
            service.raiseConflict("ws-1", "agent-1", "version-1", { ...conflict, branchKey: "" }),
        ).resolves.toBe(false)

        expect(raisedValues(records)).toMatchObject({ branchKey: null })
    })
})

describe("AgentGraphProposalsService.openOf", () => {
    it("lists the proposals still open, newest first", async () => {
        const { service, records } = await build()
        records.openProposalsOf.mockResolvedValue([proposalRow()])

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
        expect(records.openProposalsOf).toHaveBeenCalledWith(SCOPE, "agent-1", 100)
    })

    it("lists a gap with its question as the text", async () => {
        const { service, records } = await build()
        records.openProposalsOf.mockResolvedValue([
            proposalRow({ kind: "gap", patch: { question: "Do you ship to Hue?" } }),
        ])

        await expect(service.openOf("ws-1", "agent-1")).resolves.toMatchObject([
            { kind: "gap", intent: null, text: "Do you ship to Hue?" },
        ])
    })

    it("lists a contract with its intent and task", async () => {
        const { service, records } = await build()
        records.openProposalsOf.mockResolvedValue([
            proposalRow({ kind: "contract", patch: { intent: "reply_customer", task: "A deposit comes first." } }),
        ])

        await expect(service.openOf("ws-1", "agent-1")).resolves.toMatchObject([
            { kind: "contract", intent: "reply_customer", text: "A deposit comes first." },
        ])
    })
})

describe("AgentGraphProposalsService the road to a confirmed change", () => {
    const learnedOf = async (row: ReturnType<typeof proposalRow> | null) => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(row)
        return service.learnedOf("ws-1", "agent-1", "p1")
    }

    it("reads an open learned proposal as the patch it makes", async () => {
        await expect(
            learnedOf(proposalRow({ patch: { signal: "trust", amounts: [6_000_000, "x", 7_200_000] } })),
        ).resolves.toEqual({
            signal: "trust",
            branchKey: "middle",
            amounts: [6_000_000, 7_200_000],
        })
    })

    it("reads a patch without amounts as one with none, and refuses what is not open, not a signal or has no branch", async () => {
        await expect(learnedOf(proposalRow({ patch: { signal: "timeout" } }))).resolves.toEqual({
            signal: "timeout",
            branchKey: "middle",
            amounts: [],
        })
        await expect(learnedOf(proposalRow({ patch: { signal: "dance" } }))).resolves.toBeNull()
        await expect(learnedOf(proposalRow({ patch: { signal: "trust" }, branchKey: null }))).resolves.toBeNull()
        await expect(learnedOf(null)).resolves.toBeNull()
    })

    it("keeps who confirmed a proposal, when, and the version it made", async () => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(proposalRow())

        await service.confirm("ws-1", "agent-1", "p1", "member-1", "version-3")

        expect(records.patchProposal).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ id: "p1" }), {
            status: "confirmed",
            decidedBy: "member-1",
            decidedAt: DECIDED_AT,
            resultVersionId: "version-3",
        })
    })

    it("marks a proposal overtaken when its change no longer applies, and leaves one that is not open alone", async () => {
        const { service, records } = await build()
        records.proposal
            .mockResolvedValueOnce(proposalRow())
            .mockResolvedValueOnce(proposalRow({ status: "confirmed" }))

        await service.supersede("ws-1", "agent-1", "p1")
        await service.supersede("ws-1", "agent-1", "p1")

        expect(records.patchProposal).toHaveBeenCalledTimes(1)
        expect(records.patchProposal).toHaveBeenCalledWith(SCOPE, expect.anything(), { status: "superseded" })
    })
})

describe("AgentGraphProposalsService.decline", () => {
    it("records who declined an open proposal and when", async () => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(proposalRow())

        await expect(service.decline("ws-1", "agent-1", "p1", "member-1")).resolves.toBeUndefined()

        expect(records.patchProposal).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ id: "p1" }), {
            status: "declined",
            decidedBy: "member-1",
            decidedAt: DECIDED_AT,
        })
    })

    it("refuses a proposal that is not open, not the agent's, not there or changed meanwhile", async () => {
        const { service, records } = await build()
        records.proposal
            .mockResolvedValueOnce(proposalRow({ status: "declined" }))
            .mockResolvedValueOnce(proposalRow({ agentId: "agent-2" }))
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(proposalRow())
        records.patchProposal.mockResolvedValue(null)

        for (let attempt = 0; attempt < 4; attempt += 1)
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
        const { service, records } = await build()

        await expect(service.raiseGap(gap)).resolves.toBe(true)

        expect(raisedValues(records)).toEqual({
            agentId: "agent-1",
            dedupeKey: "gap:do you ship to hue",
            kind: "gap",
            baseVersionId: "version-1",
            nodeKey: null,
            branchKey: null,
            patch: { question: "Do you ship to Hue?", topic: "Shipping", trigger: "customer_message" },
            widens: false,
            evidence: { ids: [] },
        })
    })

    it("raises nothing a second time for the same question worded another way", async () => {
        const { service, records } = await build()
        records.raiseProposal.mockResolvedValue(false)

        await expect(service.raiseGap({ ...gap, question: "  DO YOU SHIP TO HUE " })).resolves.toBe(false)

        expect(raisedValues(records)).toMatchObject({ dedupeKey: "gap:do you ship to hue" })
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
                trusts: ["outsider"],
                sources: [{ kind: "brain", factId: "fact-9", passage: "Deposit 30%", valueHash: "h" }],
            },
        ],
        sources: [],
    }

    it("raises the contract for the owner to approve, with the facts it cites as evidence, once per content", async () => {
        const { service, records } = await build()

        await expect(service.raiseContract("ws-1", "agent-1", "version-1", business, ["fact-9"])).resolves.toBe(true)

        expect(raisedValues(records)).toMatchObject({
            kind: "contract",
            baseVersionId: "version-1",
            patch: { intent: "reply_customer", task: "A deposit comes first.", contract: business },
            widens: false,
            evidence: { ids: ["fact-9"] },
        })
        expect(JSON.stringify(raisedValues(records))).toMatch(/"dedupeKey":"contract:reply_customer:[0-9a-f]{64}"/u)
    })

    it("reads an open contract proposal as the business half it sets, and nothing from one that is not", async () => {
        const open = await build()
        open.records.proposal.mockResolvedValue(proposalRow({ kind: "contract", patch: { contract: business } }))
        const closed = await build()
        closed.records.proposal.mockResolvedValue(null)
        const broken = await build()
        broken.records.proposal.mockResolvedValue(proposalRow({ kind: "contract", patch: { contract: { intent: 3 } } }))

        await expect(open.service.contractOf("ws-1", "agent-1", "p1")).resolves.toEqual(business)
        await expect(closed.service.contractOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
        await expect(broken.service.contractOf("ws-1", "agent-1", "p1")).resolves.toBeNull()
    })

    it("turns an open gap into a contract proposal and overtakes the gap", async () => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(proposalRow({ id: "gap-1", kind: "gap", baseVersionId: "version-1" }))

        await expect(service.contractFromGap("ws-1", "agent-1", "gap-1", business)).resolves.toBe(true)

        expect(raisedValues(records)).toMatchObject({
            kind: "contract",
            evidence: { ids: ["gap-1"] },
            baseVersionId: "version-1",
        })
        expect(records.patchProposal).toHaveBeenCalledWith(SCOPE, expect.anything(), { status: "superseded" })
    })

    it("refuses to turn into a contract a gap that is not open", async () => {
        const { service, records } = await build()
        records.proposal.mockResolvedValue(null)

        await expect(service.contractFromGap("ws-1", "agent-1", "gap-1", business)).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )
    })
})

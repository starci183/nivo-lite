import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { OWNER_EXAMPLE, ROW_TIME, graphOf, proposalRow } from "@tests/fixtures/builders/agent-graph.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { ClosedDecision } from "./agent-graphs.contracts"
import { AgentGraphProposalEntity } from "./persistence/entities"

const GRAPH = graphOf(OWNER_EXAMPLE)

const approvals = (count: number, branchKey = "middle"): Array<ClosedDecision> =>
    Array.from({ length: count }, (_unused, index): ClosedDecision => ({ id: `d${index}`, branchKey, closedAs: "approved", amount: 6_000_000 }))

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

const inserted = (written: boolean): QueryBuilderAnswers => ({ execute: { identifiers: written ? [{ id: "p1" }] : [], raw: [] } })

describe("AgentGraphProposalsService.learn", () => {
    it("raises a proposal for the signal the decisions teach, with the decisions as evidence, and changes no version", async () => {
        const em = mockEntityManager()
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
            patch: { signal: "trust" },
            widens: true,
        })
        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ evidence: approvals(20).map((entry) => entry.id) })
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("counts only the proposals that were new, and none for an agent that taught nothing", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [inserted(false)])
        const known = await build(approvals(20), em)
        const quiet = await build(approvals(3))

        await expect(known.service.learn("ws-1", "agent-1", null, GRAPH)).resolves.toBe(0)
        await expect(quiet.service.learn("ws-1", "agent-1", null, GRAPH)).resolves.toBe(0)
    })

    it("names no node for a branch the graph no longer has", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [inserted(true)])
        const { service } = await build(approvals(20, "gone"), em)

        await service.learn("ws-1", "agent-1", null, GRAPH)

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ nodeKey: null, branchKey: "gone", baseVersionId: null })
    })
})

describe("AgentGraphProposalsService.openOf", () => {
    it("lists the proposals still open, newest first", async () => {
        const row = proposalRow()
        const em = mockEntityManager({ find: [AgentGraphProposalEntity, [row]] })
        const { service } = await build([], em)

        await expect(service.openOf("ws-1", "agent-1")).resolves.toEqual([
            { id: "p1", kind: "learned", status: "open", nodeKey: "decide", branchKey: "middle", widens: true, evidence: ["d0"], createdAt: ROW_TIME.toISOString() },
        ])
        expect(em.find).toHaveBeenCalledWith(
            AgentGraphProposalEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", agentId: "agent-1", status: "open" } }),
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

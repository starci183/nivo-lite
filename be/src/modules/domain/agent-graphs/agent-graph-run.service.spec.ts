import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionRun, RunEntry } from "./agent-graph-decisions.service"
import { AgentGraphRunService } from "./agent-graph-run.service"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"

const RUN: DecisionRun = {
    id: "decision-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    versionId: "version-1",
    wakeId: "wake-1",
    action: "pay_supplier",
    branchKey: "middle",
    outcome: "ask",
    closedAs: "approved",
    shadowDiff: false,
    facts: { "supplier_payment.amount_vnd": 7_200_000 },
    approvalRequestId: "request-1",
    path: ["decide", "middle"],
}

const build = async (run: DecisionRun | null = RUN, source: "customer" | "tag" | null = "tag") => {
    const decisions = mock<AgentGraphDecisionsService>({ runOf: jest.fn().mockResolvedValue(run) })
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 4, document: graphOf(OWNER_EXAMPLE) }),
    })
    const work = mock<AgentWorkReadService>({
        wakeSourceOf: jest.fn().mockResolvedValue(source),
        wakeOriginOf: jest.fn().mockResolvedValue(source === null ? null : "agent"),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphRunService,
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentWorkReadService, useValue: work },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphRunService), decisions, graphs, work }
}

describe("AgentGraphRunService.runsOf", () => {
    const ENTRY: RunEntry = {
        id: "decision-1",
        road: "work",
        mode: "enforced",
        action: "pay_supplier",
        versionId: "version-1",
        branchKey: "middle",
        outcome: "ask",
        gateVerdict: "ask",
        closedAs: null,
        differs: false,
        unread: [],
        unjudged: null,
        facts: {},
        path: ["decide", "middle"],
        workItemId: "item-9",
        subjectType: null,
        subjectId: null,
        createdAt: "2026-11-01T01:00:00.000Z",
    }

    it("lists the runs of the agent with the number of the version each ran on, or none when it is past the listing", async () => {
        const { service, decisions, graphs } = await build()
        decisions.runsOf.mockResolvedValue([ENTRY, { ...ENTRY, id: "decision-2", versionId: "version-0" }])
        graphs.versionsOf.mockResolvedValue([
            { id: "version-1", version: 4, changeKind: "edit", note: "", publishedAt: "", publishedBy: null },
        ])

        const runs = await service.runsOf("ws-1", "agent-1", 30)

        expect(runs.map((run) => [run.id, run.version])).toEqual([
            ["decision-1", 4],
            ["decision-2", null],
        ])
        expect(decisions.runsOf).toHaveBeenCalledWith("ws-1", "agent-1", 30)
    })
})

describe("AgentGraphRunService.runOf", () => {
    it("gives the trigger that woke the agent, the branch, the version that decided and the nodes it went through", async () => {
        const { service, graphs, work } = await build()

        const run = await service.runOf("ws-1", "item-9")

        expect(run).toMatchObject({
            decisionId: "decision-1",
            agentId: "agent-1",
            versionId: "version-1",
            version: 4,
            trigger: "tag",
            origin: "agent",
            branchKey: "middle",
            outcome: "ask",
            closedAs: "approved",
            shadowDiff: false,
            approvalRequestId: "request-1",
            factsJson: '{"supplier_payment.amount_vnd":7200000}',
        })
        expect(run.traceJson).toContain(
            '"key":"decide","title":"Check the approval level","kind":"condition","step":"evaluate","branchKey":"middle"',
        )
        expect(graphs.versionAt).toHaveBeenCalledWith("ws-1", "agent-1", "version-1")
        expect(work.wakeSourceOf).toHaveBeenCalledWith("ws-1", "wake-1")
    })

    it("names no trigger when the work did not come from a turn or the wake is gone", async () => {
        const noWake = await build({ ...RUN, wakeId: null })
        const gone = await build(RUN, null)

        await expect(noWake.service.runOf("ws-1", "item-9")).resolves.toMatchObject({ trigger: null })
        await expect(gone.service.runOf("ws-1", "item-9")).resolves.toMatchObject({ trigger: null })
        expect(noWake.work.wakeSourceOf).not.toHaveBeenCalled()
        expect(noWake.work.wakeOriginOf).not.toHaveBeenCalled()
    })

    it("refuses a work item the graph never decided", async () => {
        const { service } = await build(null)

        await expect(service.runOf("ws-1", "item-9")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.RunNotFound }),
        )
    })
})

import { Test } from "@nestjs/testing"
import { fakeIds, mock } from "@starci/jest-preset"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { DecisionsError, DecisionsErrorCode, WorkEngineService } from "@modules/domain/decisions"
import { IDS } from "@modules/platform/ids"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphAsksService } from "./agent-graph-asks.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { branchApproverOf } from "./policies/branch-approver.policy"

const VIEW: DecisionView = {
    id: "decision-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    workItemId: "item-9",
    versionId: "version-1",
    action: "pay_supplier",
    branchKey: "middle",
    amount: 7_200_000,
    approvalRequestId: "request-1",
    closed: false,
}

const BACKUP = { roles: ["owner"], rooms: [], members: [] } as const

/** The owner example with the backup the `middle` branch falls to after silence, or the answer the spec names. */
const documentWith = (
    onTimeout:
        | { readonly kind: "backup"; readonly group: typeof BACKUP }
        | { readonly kind: "stop" | "agent_owner" | "unset" },
) => {
    const base = graphOf(OWNER_EXAMPLE)
    return {
        ...base,
        nodes: base.nodes.map((node) =>
            node.decide === undefined
                ? node
                : {
                      ...node,
                      decide: {
                          ...node.decide,
                          branches: node.decide.branches.map((branch) =>
                              branch.key === "middle" && branch.approver !== null
                                  ? { ...branch, approver: { ...branch.approver, onTimeout } }
                                  : branch,
                          ),
                      },
                  },
        ),
    }
}

const build = async (
    options: { decision?: DecisionView | null; document?: ReturnType<typeof documentWith>; resume?: Error } = {},
) => {
    const document = options.document ?? documentWith({ kind: "agent_owner" })
    const graphs = mock<AgentGraphsService>({
        approverOf: jest
            .fn()
            .mockImplementation((view: DecisionView) =>
                Promise.resolve(branchApproverOf(document, view.action, view.branchKey)),
            ),
    })
    const decisions = mock<AgentGraphDecisionsService>({
        byRequest: jest.fn().mockResolvedValue(options.decision === undefined ? VIEW : options.decision),
        attachRequest: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
    })
    const requests = mock<ApprovalRequestsService>({ open: jest.fn().mockResolvedValue({ requestId: "request-2" }) })
    const engine = mock<WorkEngineService>({
        resumeWork:
            options.resume === undefined
                ? jest.fn().mockResolvedValue({})
                : jest.fn().mockRejectedValue(options.resume),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAsksService,
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: ApprovalRequestsService, useValue: requests },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphAsksService), decisions, requests, engine }
}

describe("AgentGraphAsksService.ended a verdict", () => {
    it("resumes the waiting item with the verdict of the seat and closes the decision as it ended", async () => {
        const { service, engine, decisions } = await build()

        await service.ended({ requestId: "request-1", outcome: "approved", decidedBy: "member-dinh" })
        await service.ended({ requestId: "request-1", outcome: "rejected" })

        expect(engine.resumeWork.mock.calls.map((call) => [call[1], call[2], call[4]])).toEqual([
            ["item-9", "approved", { name: "NIVO", kind: "staff", memberId: "member-dinh" }],
            ["item-9", "rejected", { name: "NIVO", kind: "staff" }],
        ])
        expect(decisions.close.mock.calls).toEqual([
            ["item-9", "approved"],
            ["item-9", "rejected"],
        ])
    })

    it("closes the decision and goes on when a person had already settled the item", async () => {
        const { service, decisions } = await build({
            resume: new DecisionsError({ code: DecisionsErrorCode.NotWaiting }),
        })

        await service.ended({ requestId: "request-1", outcome: "approved", decidedBy: "member-dinh" })

        expect(decisions.close).toHaveBeenCalledWith("item-9", "approved")
    })

    it("lets any other failure of the resume go back to the bus, to be delivered again", async () => {
        const { service, decisions } = await build({ resume: new Error("db down") })

        await expect(service.ended({ requestId: "request-1", outcome: "approved" })).rejects.toThrow("db down")
        expect(decisions.close).not.toHaveBeenCalled()
    })

    it("does nothing for a request no decision owns, one already closed, or an end it does not know", async () => {
        const none = await build({ decision: null })
        const closed = await build({ decision: { ...VIEW, closed: true } })
        const odd = await build()

        await none.service.ended({ requestId: "request-1", outcome: "approved" })
        await closed.service.ended({ requestId: "request-1", outcome: "approved" })
        await odd.service.ended({ requestId: "request-1", outcome: "cancelled" })

        expect(none.engine.resumeWork).not.toHaveBeenCalled()
        expect(closed.engine.resumeWork).not.toHaveBeenCalled()
        expect(odd.engine.resumeWork).not.toHaveBeenCalled()
        expect(odd.decisions.close).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAsksService.ended a deadline", () => {
    it("opens one more request for the backup group when the branch names one, and keeps the decision open", async () => {
        const { service, requests, decisions } = await build({
            document: documentWith({ kind: "backup", group: BACKUP }),
        })

        await service.ended({ requestId: "request-1", outcome: "expired" })

        expect(requests.open.mock.calls[0]?.[0]).toMatchObject({
            chainStepId: "00000000-0000-4000-8000-000000000001",
            branch: { group: BACKUP, policy: "any", timeoutMinutes: 240 },
        })
        expect(decisions.attachRequest).toHaveBeenCalledWith("decision-1", "request-2")
        expect(decisions.close).not.toHaveBeenCalled()
    })

    it("rejects the item when the branch says stop, and closes the decision as expired", async () => {
        const { service, engine, decisions } = await build({ document: documentWith({ kind: "stop" }) })

        await service.ended({ requestId: "request-1", outcome: "expired" })

        expect(engine.resumeWork.mock.calls.map((call) => [call[2], call[4]])).toEqual([
            ["rejected", { name: "NIVO", kind: "staff" }],
        ])
        expect(decisions.close.mock.calls).toEqual([
            ["item-9", "rejected"],
            ["item-9", "expired"],
        ])
    })

    it("leaves the item to the owner of the agent otherwise, and closes the decision as expired", async () => {
        const owner = await build()
        const unset = await build({ document: documentWith({ kind: "unset" }) })
        const gone = await build({ decision: { ...VIEW, branchKey: "small" } })

        await owner.service.ended({ requestId: "request-1", outcome: "expired" })
        await unset.service.ended({ requestId: "request-1", outcome: "expired" })
        await gone.service.ended({ requestId: "request-1", outcome: "expired" })

        for (const built of [owner, unset, gone]) {
            expect(built.engine.resumeWork).not.toHaveBeenCalled()
            expect(built.requests.open).not.toHaveBeenCalled()
            expect(built.decisions.close).toHaveBeenCalledWith("item-9", "expired")
        }
    })
})

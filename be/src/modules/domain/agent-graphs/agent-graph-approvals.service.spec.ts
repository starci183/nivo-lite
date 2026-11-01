import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApprovalRequestsReadService, ApprovalRequestsService } from "@modules/domain/approval-requests"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
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

const build = async (options: { decision?: DecisionView | null } = {}) => {
    const logger = mock<Logger>()
    const document = graphOf(OWNER_EXAMPLE)
    const graphs = mock<AgentGraphsService>({
        approverOf: jest
            .fn()
            .mockImplementation((view: DecisionView) =>
                Promise.resolve(branchApproverOf(document, view.action, view.branchKey)),
            ),
    })
    const decisions = mock<AgentGraphDecisionsService>({
        byId: jest.fn().mockResolvedValue(options.decision === undefined ? VIEW : options.decision),
        byItem: jest.fn().mockResolvedValue(options.decision === undefined ? VIEW : options.decision),
        attachRequest: jest.fn().mockResolvedValue(undefined),
    })
    const requests = mock<ApprovalRequestsService>({ open: jest.fn().mockResolvedValue({ requestId: "request-2" }) })
    const asked = mock<ApprovalRequestsReadService>({ askedOf: jest.fn().mockResolvedValue(["member-dinh"]) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphApprovalsService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: ApprovalRequestsService, useValue: requests },
            { provide: ApprovalRequestsReadService, useValue: asked },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphApprovalsService), logger, decisions, requests, asked }
}

describe("AgentGraphApprovalsService.route", () => {
    it("opens the request of the branch with its group, policy and wait, keyed by the decision, and remembers it", async () => {
        const { service, requests, decisions } = await build()

        await service.route({ workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" })

        expect(requests.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            chainStepId: "decision-1",
            action: "pay_supplier",
            amount: 7_200_000,
            unit: "vnd",
            requestedByAgentId: "agent-1",
            branch: { group: { roles: ["manager"], rooms: [], members: ["dinh"] }, policy: "any", timeoutMinutes: 240 },
        })
        expect(decisions.attachRequest).toHaveBeenCalledWith("decision-1", "request-2")
    })

    it("leaves the item with the people who govern when the decision is gone or the branch named nobody", async () => {
        const gone = await build({ decision: null })
        const nobody = await build({ decision: { ...VIEW, branchKey: "small" } })

        await gone.service.route({ workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" })
        await nobody.service.route({ workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" })

        expect(gone.requests.open).not.toHaveBeenCalled()
        expect(nobody.requests.open).not.toHaveBeenCalled()
    })

    it("logs and goes on when the request cannot be opened", async () => {
        const { service, requests, logger, decisions } = await build()
        requests.open.mockRejectedValue(new Error("no rule"))

        await service.route({ workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" })

        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.AskNotRouted, expect.any(Error), {
            decisionId: "decision-1",
        })
        expect(decisions.attachRequest).not.toHaveBeenCalled()
    })
})

describe("AgentGraphApprovalsService.mayDecide", () => {
    const answerer = { workspaceId: "ws-1", workItemId: "item-9", memberId: "member-dinh", isOwner: false }

    it("lets the people the request asked answer, and refuses anyone else", async () => {
        const { service, asked } = await build()

        await expect(service.mayDecide(answerer)).resolves.toBe(true)
        await expect(service.mayDecide({ ...answerer, memberId: "member-nam" })).resolves.toBe(false)
        expect(asked.askedOf).toHaveBeenCalledWith("ws-1", "request-1")
    })

    it("always lets the owner of the workspace answer", async () => {
        const { service, asked } = await build()

        await expect(service.mayDecide({ ...answerer, memberId: "member-nam", isOwner: true })).resolves.toBe(true)
        expect(asked.askedOf).not.toHaveBeenCalled()
    })

    it("holds back nobody when no request of a branch is open for the item", async () => {
        const none = await build({ decision: null })
        const closed = await build({ decision: { ...VIEW, closed: true } })
        const unrouted = await build({ decision: { ...VIEW, approvalRequestId: null } })
        const settled = await build()
        settled.asked.askedOf.mockResolvedValue([])

        await expect(none.service.mayDecide(answerer)).resolves.toBe(true)
        await expect(closed.service.mayDecide(answerer)).resolves.toBe(true)
        await expect(unrouted.service.mayDecide(answerer)).resolves.toBe(true)
        await expect(settled.service.mayDecide(answerer)).resolves.toBe(true)
    })
})

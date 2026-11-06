import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { IDS } from "@modules/platform/ids"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphAsksService } from "./agent-graph-asks.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { branchApproverOf } from "./policies/branch-approver.policy"
import { GRAPH_WORK_DECISIONS } from "./agent-graphs.decorators"
import type { GraphWorkDecisions } from "./graph-work-decisions.port"

const VIEW: DecisionView = {
    id: "decision-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    workItemId: "item-9",
    versionId: "version-1",
    action: "pay_supplier",
    branchKey: "middle",
    path: ["decide", "middle"],
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
    options: {
        decision?: DecisionView | null
        document?: ReturnType<typeof documentWith>
        resume?: Error | false
    } = {},
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
    const tx = fakeTransaction(mockEntityManager())
    const work = mock<GraphWorkDecisions>({
        resume:
            options.resume instanceof Error
                ? jest.fn().mockRejectedValue(options.resume)
                : jest.fn().mockResolvedValue(options.resume !== false),
        claim: jest.fn().mockResolvedValue({ kind: "open" }),
        closedOutcome: jest.fn().mockResolvedValue("approved"),
        reject: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAsksService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: GRAPH_WORK_DECISIONS, useValue: work },
            { provide: IDS, useValue: fakeIds() },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: ApprovalRequestsService, useValue: requests },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphAsksService), decisions, requests, work, tx }
}

describe("AgentGraphAsksService.ended a verdict", () => {
    it("resumes the waiting item with the verdict of the seat and closes the decision as it ended", async () => {
        const { service, work, decisions } = await build()

        await service.ended({
            workspaceId: "ws-1",
            requestId: "request-1",
            outcome: "approved",
            decidedBy: "member-dinh",
        })
        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "rejected" })

        expect(work.resume.mock.calls).toEqual([
            [{ workspaceId: "ws-1", workItemId: "item-9", outcome: "approved", memberId: "member-dinh" }],
            [{ workspaceId: "ws-1", workItemId: "item-9", outcome: "rejected", memberId: null }],
        ])
        expect(decisions.close.mock.calls).toEqual([
            ["ws-1", "item-9", "approved"],
            ["ws-1", "item-9", "rejected"],
        ])
    })

    it("closes the decision and goes on when a person had already settled the item", async () => {
        const { service, decisions, work, tx } = await build({ resume: false })

        await service.ended({
            workspaceId: "ws-1",
            requestId: "request-1",
            outcome: "approved",
            decidedBy: "member-dinh",
        })

        expect(
            work.closedOutcome.mock.calls.map(([manager, workspace, item]) => [
                manager?.queryRunner?.isTransactionActive === false,
                workspace,
                item,
            ]),
        ).toEqual([[true, "ws-1", "item-9"]])
        expect(
            decisions.close.mock.calls.map(([, item, outcome, manager]) => [
                item,
                outcome,
                manager?.queryRunner?.isTransactionActive === false,
            ]),
        ).toEqual([["item-9", "approved", true]])
        expect(tx.outcomes).toEqual(["commit"])
    })

    it("lets any other failure of the resume go back to the bus, to be delivered again", async () => {
        const { service, decisions } = await build({ resume: new Error("db down") })

        await expect(
            service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "approved" }),
        ).rejects.toThrow("db down")
        expect(decisions.close).not.toHaveBeenCalled()
    })

    it("does nothing for a request no decision owns, one already closed, or an end it does not know", async () => {
        const none = await build({ decision: null })
        const closed = await build({ decision: { ...VIEW, closed: true } })
        const odd = await build()

        await none.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "approved" })
        await closed.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "approved" })
        await odd.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "cancelled" })

        expect(none.work.resume).not.toHaveBeenCalled()
        expect(closed.work.resume).not.toHaveBeenCalled()
        expect(odd.work.resume).not.toHaveBeenCalled()
        expect(odd.decisions.close).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAsksService.ended a deadline", () => {
    it("opens one more request for the backup group when the branch names one, and keeps the decision open", async () => {
        const { service, requests, decisions } = await build({
            document: documentWith({ kind: "backup", group: BACKUP }),
        })

        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })

        expect(requests.open.mock.calls[0]?.[0]).toMatchObject({
            chainStepId: "00000000-0000-4000-8000-000000000001",
            branch: { group: BACKUP, policy: "any", timeoutMinutes: 240 },
        })
        expect(decisions.attachRequest).toHaveBeenCalledWith("ws-1", "decision-1", "request-2", expect.anything())
        expect(decisions.close).not.toHaveBeenCalled()
    })

    it("rejects the item when the branch says stop, and closes the decision as expired", async () => {
        const { service, work, decisions } = await build({ document: documentWith({ kind: "stop" }) })

        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })

        expect(work.resume).not.toHaveBeenCalled()
        expect(work.reject).toHaveBeenCalledWith(expect.anything(), "ws-1", "item-9")
        expect(decisions.close.mock.calls.map(([, id, outcome]) => [id, outcome])).toEqual([
            ["item-9", "rejected"],
            ["item-9", "expired"],
        ])
    })

    it("leaves the item to the owner of the agent otherwise, and closes the decision as expired", async () => {
        const owner = await build()
        const unset = await build({ document: documentWith({ kind: "unset" }) })
        const gone = await build({ decision: { ...VIEW, branchKey: "small" } })

        await owner.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })
        await unset.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })
        await gone.service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })

        for (const built of [owner, unset, gone]) {
            expect(built.work.resume).not.toHaveBeenCalled()
            expect(built.requests.open).not.toHaveBeenCalled()
            expect(built.decisions.close).toHaveBeenCalledWith("ws-1", "item-9", "expired", expect.anything())
        }
    })
})

describe("AgentGraphAsksService concurrent owner truth", () => {
    it("uses the already-closed owner decision inside a caller transaction without starting a backup", async () => {
        const manager = mockEntityManager()
        const { service, decisions, work, requests } = await build()
        work.claim.mockResolvedValue({ kind: "closed", outcome: "approved" })

        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" }, manager)

        expect(decisions.close).toHaveBeenCalledWith("ws-1", "item-9", "approved", manager)
        expect(work.claim).toHaveBeenCalledWith(manager, "ws-1", "item-9")
        expect(requests.open).not.toHaveBeenCalled()
        expect(work.reject).not.toHaveBeenCalled()
    })

    it("replays a closed owner's rejection before applying a deadline's backup or stop policy", async () => {
        const { service, decisions, work, requests, tx } = await build({ document: documentWith({ kind: "stop" }) })
        work.claim.mockResolvedValue({ kind: "closed", outcome: "rejected" })

        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "expired" })

        expect(
            decisions.close.mock.calls.map(([, item, outcome, manager]) => [
                item,
                outcome,
                manager?.queryRunner?.isTransactionActive === false,
            ]),
        ).toEqual([["item-9", "rejected", true]])
        expect(work.reject).not.toHaveBeenCalled()
        expect(requests.open).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
    })

    it("retries an event while a person is already deciding instead of closing opposite graph history", async () => {
        const { service, decisions, work, tx } = await build({ resume: false })
        const busy = new Error("work owner is deciding")
        work.closedOutcome.mockRejectedValue(busy)
        await expect(service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "approved" })).rejects.toBe(
            busy,
        )
        expect(decisions.close).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["rollback"])
    })

    it("reconciles the actual closed rejection even when an older approval event arrives", async () => {
        const { service, decisions, work, tx } = await build({ resume: false })
        work.closedOutcome.mockResolvedValue("rejected")
        await service.ended({ workspaceId: "ws-1", requestId: "request-1", outcome: "approved" })
        expect(
            decisions.close.mock.calls.map(([, item, outcome, manager]) => [
                item,
                outcome,
                manager?.queryRunner?.isTransactionActive === false,
            ]),
        ).toEqual([["item-9", "rejected", true]])
        expect(tx.outcomes).toEqual(["commit"])
    })
})

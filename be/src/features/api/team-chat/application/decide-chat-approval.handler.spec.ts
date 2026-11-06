import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    ApprovalRequestsError,
    ApprovalRequestsErrorCode,
    ApprovalRequestsService,
} from "@modules/domain/approval-requests"
import { TeamChatService } from "@modules/domain/team-chat"
import type { ApprovalState } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import { DecideChatApprovalCommand } from "./decide-chat-approval.command"
import { DecideChatApprovalHandler } from "./decide-chat-approval.handler"

const WS = "11111111-1111-4111-8111-111111111111"
const DECISION = "22222222-2222-4222-8222-222222222222"
const PRINCIPAL = { id: "user-1", role: "authenticated" as const }
const STATE: ApprovalState = {
    decisionId: DECISION,
    status: "approved",
    decidedByName: "Lan",
    decidedAt: new Date(0),
    canDecide: false,
}

const build = async () => {
    const requests = mock<ApprovalRequestsService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const chat = mock<TeamChatService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecideChatApprovalHandler,
            { provide: ApprovalRequestsService, useValue: requests },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: TeamChatService, useValue: chat },
            { provide: LOGGER, useValue: mock<object>() },
        ],
    }).compile()
    const handler = moduleRef.get(DecideChatApprovalHandler)
    const run = (verdict: "approve" | "reject" = "approve") =>
        handler.execute(
            new DecideChatApprovalCommand({
                request: { workspaceId: WS, decisionId: DECISION, verdict },
                principal: PRINCIPAL,
            }),
        )
    return { run, requests, seats, chat }
}

describe("DecideChatApprovalHandler", () => {
    it("settles the decision as the seat of the caller and answers the state every card now shows", async () => {
        const { run, requests, seats, chat } = await build()
        seats.activeSeatOfUser.mockResolvedValue({
            memberId: "seat-1",
            userId: "user-1",
            role: "staff",
            displayName: "Lan",
            status: "active",
        })
        chat.approvalOf.mockResolvedValue(STATE)
        await expect(run("reject")).resolves.toEqual({ ok: true, approval: STATE })
        expect(requests.decide).toHaveBeenCalledWith({ requestId: DECISION, memberId: "seat-1", verdict: "reject" })
        expect(chat.approvalOf).toHaveBeenCalledWith(WS, "user-1", DECISION)
    })

    it("refuses a caller with no seat, and a request that vanished, as data", async () => {
        const { run, seats, chat } = await build()
        seats.activeSeatOfUser.mockResolvedValue(null)
        await expect(run()).resolves.toEqual({ ok: false, refusal: "not_an_approver" })
        seats.activeSeatOfUser.mockResolvedValue({
            memberId: "seat-1",
            userId: "user-1",
            role: "staff",
            displayName: "Lan",
            status: "active",
        })
        chat.approvalOf.mockResolvedValue(null)
        await expect(run()).resolves.toEqual({ ok: false, refusal: "decision_not_found" })
    })

    it("turns the refusals of the decisions core into data and lets any other failure fail", async () => {
        const { run, requests, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValue({
            memberId: "seat-1",
            userId: "user-1",
            role: "staff",
            displayName: "Lan",
            status: "active",
        })
        requests.decide.mockRejectedValue(new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.NotInGroup }))
        await expect(run()).resolves.toEqual({ ok: false, refusal: "not_an_approver" })
        requests.decide.mockRejectedValue(new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.AlreadyDecided }))
        await expect(run()).resolves.toEqual({ ok: false, refusal: "decision_closed" })
        requests.decide.mockRejectedValue(new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.NoRule }))
        await expect(run()).rejects.toMatchObject({ code: ApprovalRequestsErrorCode.NoRule })
        requests.decide.mockRejectedValue(new Error("db down"))
        await expect(run()).rejects.toThrow("db down")
    })
})

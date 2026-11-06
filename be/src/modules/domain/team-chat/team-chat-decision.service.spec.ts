import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    ApprovalRequestsError,
    ApprovalRequestsErrorCode,
    ApprovalRequestsService,
} from "@modules/domain/approval-requests"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { DecideVerdict } from "./team-chat-decision.policy"
import { TeamChatDecisionService } from "./team-chat-decision.service"
import { TeamChatRoomsService } from "./team-chat.service"
import type { ApprovalState } from "./team-chat.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const DECISION = "22222222-2222-4222-8222-222222222222"
const STATE: ApprovalState = {
    decisionId: DECISION,
    status: "approved",
    decidedByName: "Lan",
    decidedAt: new Date(0),
    canDecide: false,
}
const SEAT = { memberId: "seat-1", userId: "user-1", role: "staff", displayName: "Lan", status: "active" } as const

const build = async () => {
    const requests = mock<ApprovalRequestsService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const chat = mock<TeamChatRoomsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatDecisionService,
            { provide: ApprovalRequestsService, useValue: requests },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: TeamChatRoomsService, useValue: chat },
        ],
    }).compile()
    const service = moduleRef.get(TeamChatDecisionService)
    const run = (verdict: DecideVerdict = "approve") => service.decide(WS, "user-1", DECISION, verdict)
    return { run, requests, seats, chat }
}

describe("TeamChatDecisionService decide", () => {
    it("settles the decision as the seat of the caller and answers the state every card now shows", async () => {
        const { run, requests, seats, chat } = await build()
        seats.activeSeatOfUser.mockResolvedValue(SEAT)
        chat.approvalOf.mockResolvedValue(STATE)
        await expect(run("reject")).resolves.toEqual({ ok: true, approval: STATE })
        expect(requests.decide).toHaveBeenCalledWith({ requestId: DECISION, memberId: "seat-1", verdict: "reject" })
        expect(chat.approvalOf).toHaveBeenCalledWith(WS, "user-1", DECISION)
    })

    it("refuses a caller with no seat, and a request that vanished, as data", async () => {
        const { run, seats, chat } = await build()
        seats.activeSeatOfUser.mockResolvedValue(null)
        await expect(run()).resolves.toEqual({ ok: false, refusal: "not_an_approver" })
        seats.activeSeatOfUser.mockResolvedValue(SEAT)
        chat.approvalOf.mockResolvedValue(null)
        await expect(run()).resolves.toEqual({ ok: false, refusal: "decision_not_found" })
    })

    it("turns the refusals of the decisions core into data and lets any other failure fail", async () => {
        const { run, requests, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValue(SEAT)
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

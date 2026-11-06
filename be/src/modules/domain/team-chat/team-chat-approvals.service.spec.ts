import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApprovalRequestsReadService } from "@modules/domain/approval-requests"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const AGENT = "31111111-1111-4111-8111-111111111111"
const D1 = "71111111-1111-4111-8111-111111111111"
const D2 = "72222222-1111-4111-8111-111111111111"
const DECIDED = new Date("2026-11-06T10:00:00.000Z")
const GROUP = { roles: [], rooms: [], members: [] }

const build = async () => {
    const requests = mock<ApprovalRequestsReadService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatApprovalsService,
            { provide: ApprovalRequestsReadService, useValue: requests },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
        ],
    }).compile()
    return { approvals: moduleRef.get(TeamChatApprovalsService), requests, seats }
}

describe("TeamChatApprovalsService requestOf", () => {
    it("answers the request a card is about, with the group it stored", async () => {
        const { approvals, requests } = await build()
        requests.cardOf.mockResolvedValue({
            id: D1,
            action: "refund",
            amount: 200000,
            unit: "vnd",
            requestedByAgentId: AGENT,
            approverGroup: GROUP,
        })
        await expect(approvals.requestOf(WS, D1)).resolves.toEqual({
            id: D1,
            action: "refund",
            amount: 200000,
            unit: "vnd",
            requestedByAgentId: AGENT,
            storedGroup: GROUP,
        })
        expect(requests.cardOf).toHaveBeenCalledWith(WS, D1)
    })

    it("answers nothing for a request the workspace does not have", async () => {
        const { approvals, requests } = await build()
        requests.cardOf.mockResolvedValue(null)
        await expect(approvals.requestOf(WS, D1)).resolves.toBeNull()
    })
})

describe("TeamChatApprovalsService states", () => {
    it("reads nothing for no decision", async () => {
        const { approvals, requests } = await build()
        await expect(approvals.statesOf(WS, ANA, [])).resolves.toEqual(new Map())
        expect(requests.standingOf).not.toHaveBeenCalled()
    })

    it("tells where each decision stands, who settled it and whether the viewer may decide", async () => {
        const { approvals, requests, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValue({
            memberId: "seat-ana",
            userId: ANA,
            role: "staff",
            displayName: "Ana",
            status: "active",
        })
        requests.standingOf.mockResolvedValue([
            { id: D1, status: "pending", resolvedAt: null, resolvedBy: null, askedSeatIds: ["seat-ana"] },
            { id: D2, status: "rejected", resolvedAt: DECIDED, resolvedBy: "seat-lan", askedSeatIds: [] },
        ])
        seats.seatsByIds.mockResolvedValue([
            { memberId: "seat-lan", userId: "u-lan", role: "owner", displayName: "Lan", status: "active" },
        ])
        const states = await approvals.statesOf(WS, ANA, [D1, D2, D1])
        expect(requests.standingOf).toHaveBeenCalledWith(WS, [D1, D2])
        expect(seats.seatsByIds).toHaveBeenCalledWith(WS, ["seat-lan"], 1)
        expect(states).toEqual(
            new Map([
                [D1, { decisionId: D1, status: "pending", decidedByName: null, decidedAt: null, canDecide: true }],
                [D2, { decisionId: D2, status: "refused", decidedByName: "Lan", decidedAt: DECIDED, canDecide: false }],
            ]),
        )
    })

    it("lets nobody decide when the viewer holds no active seat", async () => {
        const { approvals, requests, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValue(null)
        requests.standingOf.mockResolvedValue([
            { id: D1, status: "pending", resolvedAt: null, resolvedBy: null, askedSeatIds: ["seat-ana"] },
        ])
        seats.seatsByIds.mockResolvedValue([])
        await expect(approvals.stateOf(WS, ANA, D1)).resolves.toMatchObject({ canDecide: false })
    })

    it("answers nothing for a decision the workspace does not have", async () => {
        const { approvals, requests, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValue(null)
        requests.standingOf.mockResolvedValue([])
        seats.seatsByIds.mockResolvedValue([])
        await expect(approvals.stateOf(WS, ANA, D1)).resolves.toBeNull()
    })
})

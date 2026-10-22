import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HA_REF, IN_30_MINUTES, MINH_REF, openOf } from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalDecidingService } from "./approval-deciding.service"
import { ApprovalOpeningService } from "./approval-opening.service"
import type { ApprovalProgress, OpenedApproval } from "./approval-requests.contracts"
import { ApprovalRequestsService } from "./approval-requests.service"
import { ApprovalSweepService } from "./approval-sweep.service"

const OPENED: OpenedApproval = {
    requestId: "request-1",
    approvers: [MINH_REF, HA_REF],
    excluded: [],
    policy: "any",
    expiresAt: IN_30_MINUTES,
}

const PROGRESS: ApprovalProgress = {
    requestId: "request-1",
    status: "approved",
    approvedBy: ["member-minh"],
    remaining: [],
}

const build = async () => {
    const opening = mock<ApprovalOpeningService>()
    opening.open.mockResolvedValue(OPENED)
    const deciding = mock<ApprovalDecidingService>()
    deciding.decide.mockResolvedValue(PROGRESS)
    const sweeping = mock<ApprovalSweepService>()
    sweeping.sweep.mockResolvedValue({ expired: 2, reminded: 1 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalRequestsService,
            { provide: ApprovalOpeningService, useValue: opening },
            { provide: ApprovalDecidingService, useValue: deciding },
            { provide: ApprovalSweepService, useValue: sweeping },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalRequestsService), opening, deciding }
}

describe("ApprovalRequestsService", () => {
    it("opens the request of a chain step", async () => {
        const { service, opening } = await build()
        const params = openOf()

        await expect(service.open(params)).resolves.toEqual(OPENED)

        expect(opening.open.mock.calls).toEqual([[params]])
    })

    it("takes the verdict of a member", async () => {
        const { service, deciding } = await build()
        const params = { requestId: "request-1", memberId: "member-minh", verdict: "approve" as const }

        await expect(service.decide(params)).resolves.toEqual(PROGRESS)

        expect(deciding.decide.mock.calls).toEqual([[params]])
    })

    it("runs the minute tick", async () => {
        const { service } = await build()

        await expect(service.sweep()).resolves.toEqual({ expired: 2, reminded: 1 })
    })
})

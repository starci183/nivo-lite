import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
import { GraphWorkDecisionService } from "./graph-work-decision.service"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkDecisionTimeoutService } from "./work-decision-timeout.service"
import { WorkEngineService } from "./work-engine.service"

const build = async () => {
    const engine = mock<WorkEngineService>({ resumeWork: jest.fn().mockResolvedValue(itemOf()) })
    const timeouts = mock<WorkDecisionTimeoutService>({
        claim: jest.fn().mockResolvedValue({ kind: "open" }),
        reject: jest.fn().mockResolvedValue(true),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphWorkDecisionService,
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkDecisionTimeoutService, useValue: timeouts },
        ],
    }).compile()
    return { service: moduleRef.get(GraphWorkDecisionService), engine, timeouts }
}

describe("GraphWorkDecisionService.resume", () => {
    it("preserves the authenticated seat separately from the background actor and never invents an anonymous member", async () => {
        const { service, engine } = await build()
        await expect(
            service.resume({ workspaceId: "ws-1", workItemId: "item-1", outcome: "approved", memberId: "member-1" }),
        ).resolves.toBe(true)
        await expect(
            service.resume({ workspaceId: "ws-1", workItemId: "item-2", outcome: "rejected", memberId: null }),
        ).resolves.toBe(true)
        expect(engine.resumeWork.mock.calls).toEqual([
            [
                { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
                "item-1",
                "approved",
                {},
                { name: "NIVO", kind: "staff", memberId: "member-1" },
            ],
            [
                { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
                "item-2",
                "rejected",
                {},
                { name: "NIVO", kind: "staff" },
            ],
        ])
    })

    it("reports a competing resume explicitly and propagates every other owner refusal", async () => {
        const { service, engine } = await build()
        const request = { workspaceId: "ws-1", workItemId: "item-1", outcome: "approved", memberId: null } as const
        engine.resumeWork.mockRejectedValueOnce(new DecisionsError({ code: DecisionsErrorCode.NotWaiting }))
        await expect(service.resume(request)).resolves.toBe(false)
        const busy = new DecisionsError({ code: DecisionsErrorCode.WorkBusy })
        engine.resumeWork.mockRejectedValueOnce(busy)
        await expect(service.resume(request)).rejects.toBe(busy)
        const unavailable = new Error("work owner unavailable")
        engine.resumeWork.mockRejectedValueOnce(unavailable)
        await expect(service.resume(request)).rejects.toBe(unavailable)
    })
})

describe("GraphWorkDecisionService.claim", () => {
    it("uses the caller's manager and exact item scope while leaving an open owner undecided", async () => {
        const { service, timeouts } = await build()
        const manager = mockEntityManager()
        await expect(service.claim(manager, "ws-1", "item-1")).resolves.toEqual({ kind: "open" })
        expect(timeouts.claim).toHaveBeenCalledWith(manager, "ws-1", "item-1")
    })

    it("maps actual committed completion and rejection without taking the incoming event's verdict", async () => {
        const { service, timeouts } = await build()
        const manager = mockEntityManager()
        timeouts.claim.mockResolvedValueOnce({ kind: "closed", item: itemOf({ status: "done" }), memberId: "member-1" })
        timeouts.claim.mockResolvedValueOnce({
            kind: "closed",
            item: itemOf({ status: "rejected" }),
            memberId: "member-2",
        })
        await expect(service.claim(manager, "ws-1", "item-1")).resolves.toEqual({ kind: "closed", outcome: "approved" })
        await expect(service.claim(manager, "ws-1", "item-2")).resolves.toEqual({ kind: "closed", outcome: "rejected" })
    })

    it("refuses in-flight work so the graph cannot commit a competing timeout", async () => {
        const { service, timeouts } = await build()
        timeouts.claim.mockResolvedValue({ kind: "busy" })
        await expect(service.claim(mockEntityManager(), "ws-1", "item-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.WorkBusy,
        })
        expect(timeouts.reject).not.toHaveBeenCalled()
    })
})

describe("GraphWorkDecisionService.closedOutcome", () => {
    it("requires a committed owner outcome after a competing human resume", async () => {
        const { service, timeouts } = await build()
        const manager = mockEntityManager()
        await expect(service.closedOutcome(manager, "ws-1", "item-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.WorkBusy,
        })
        timeouts.claim.mockResolvedValue({ kind: "closed", item: itemOf({ status: "done" }), memberId: "member-1" })
        await expect(service.closedOutcome(manager, "ws-1", "item-1")).resolves.toBe("approved")
    })
})

describe("GraphWorkDecisionService.reject", () => {
    it("retains the caller transaction and refuses a stop that lost its owner claim", async () => {
        const { service, timeouts } = await build()
        const manager = mockEntityManager()
        await expect(service.reject(manager, "ws-1", "item-1")).resolves.toBeUndefined()
        expect(timeouts.reject).toHaveBeenCalledWith(manager, "ws-1", "item-1")
        timeouts.reject.mockResolvedValue(false)
        await expect(service.reject(manager, "ws-1", "item-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.WorkBusy,
        })
    })
})

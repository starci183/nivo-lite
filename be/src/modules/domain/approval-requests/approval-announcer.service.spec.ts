import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HA_REF, MINH_REF } from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import { ApprovalEvidenceService } from "./approval-evidence.service"

const RESOLVED: ApprovalResolved = {
    requestId: "request-1",
    outcome: "approved",
    decidedBy: "member-minh",
    decidedByName: "Anh Minh",
    action: "give_discount",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    escalatedTo: null,
}

const REMINDER: ApprovalReminder = {
    requestId: "request-1",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    action: "give_discount",
    remaining: [MINH_REF, HA_REF],
    expiresAt: "2026-10-22T10:00:00.000Z",
}

const build = async () => {
    const bus = mock<EventBus>()
    bus.publish.mockResolvedValue(undefined)
    const evidence = mock<ApprovalEvidenceService>()
    evidence.resolved.mockResolvedValue(undefined)
    evidence.reminder.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalAnnouncerService,
            { provide: LOGGER, useValue: logger },
            { provide: EVENT_BUS, useValue: bus },
            { provide: ApprovalEvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalAnnouncerService), bus, evidence, logger }
}

describe("ApprovalAnnouncerService", () => {
    const tx = mockEntityManager({})

    it("writes a settled request into the evidence log, then publishes approval_resolved, both in the caller's transaction", async () => {
        const { service, bus, evidence } = await build()

        await expect(service.resolved(RESOLVED, tx)).resolves.toBeUndefined()

        expect(evidence.resolved).toHaveBeenCalledWith(RESOLVED, tx)
        expect(bus.publish).toHaveBeenCalledTimes(1)
        const [event, manager, correlationId] = bus.publish.mock.calls[0] ?? []
        expect(manager).toBe(tx)
        expect(correlationId).toBe("request-1")
        expect(event).toMatchObject({
            eventId: "request-1",
            eventName: "approval_resolved",
            payload: {
                dedupeKey: "request-1",
                requestId: "request-1",
                workspaceId: "ws-1",
                outcome: "approved",
                decidedBy: "member-minh",
                action: "give_discount",
                chainStepId: "step-1",
            },
        })
        expect(evidence.resolved.mock.invocationCallOrder[0]).toBeLessThan(bus.publish.mock.invocationCallOrder[0] ?? 0)
    })

    it("writes the reminder of a request into the evidence log only", async () => {
        const { service, bus, evidence } = await build()

        await expect(service.reminder(REMINDER)).resolves.toBeUndefined()

        expect(evidence.reminder).toHaveBeenCalledWith(REMINDER)
        expect(bus.publish).not.toHaveBeenCalled()
    })

    it("lets a failure to publish undo the settling instead of swallowing it, so the card is never stranded", async () => {
        const { service, bus } = await build()
        const cause = new Error("bus down")
        bus.publish.mockRejectedValue(cause)

        await expect(service.resolved(RESOLVED, tx)).rejects.toBe(cause)
    })

    it("publishes nothing when the evidence line fails, and the failure undoes the settling", async () => {
        const { service, bus, evidence } = await build()
        const cause = new Error("log down")
        evidence.resolved.mockRejectedValue(cause)

        await expect(service.resolved(RESOLVED, tx)).rejects.toBe(cause)

        expect(bus.publish).not.toHaveBeenCalled()
    })

    it("logs and swallows a failure to write a reminder", async () => {
        const { service, evidence, logger } = await build()
        const cause = new Error("log down")
        evidence.reminder.mockRejectedValue(cause)

        await expect(service.reminder(REMINDER)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(ApprovalLogEvent.ReminderEventFailed, cause, {
            requestId: "request-1",
        })
    })
})

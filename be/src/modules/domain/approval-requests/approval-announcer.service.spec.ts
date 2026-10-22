import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HA_REF, MINH_REF } from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { APPROVAL_EVENTS } from "./approval-requests.decorators"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalEvents } from "./approval-requests.port"
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
    const events = mock<ApprovalEvents>()
    events.resolved.mockResolvedValue(undefined)
    const evidence = mock<ApprovalEvidenceService>()
    evidence.resolved.mockResolvedValue(undefined)
    evidence.reminder.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalAnnouncerService,
            { provide: LOGGER, useValue: logger },
            { provide: APPROVAL_EVENTS, useValue: events },
            { provide: ApprovalEvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalAnnouncerService), events, evidence, logger }
}

describe("ApprovalAnnouncerService", () => {
    it("writes a settled request into the evidence log, then hands it to the owner of the events port", async () => {
        const { service, events, evidence } = await build()

        await expect(service.resolved(RESOLVED)).resolves.toBeUndefined()

        expect(evidence.resolved).toHaveBeenCalledWith(RESOLVED)
        expect(events.resolved).toHaveBeenCalledWith(RESOLVED)
        expect(evidence.resolved.mock.invocationCallOrder).toEqual([
            Math.min(...evidence.resolved.mock.invocationCallOrder, ...events.resolved.mock.invocationCallOrder),
        ])
    })

    it("writes the reminder of a request into the evidence log only", async () => {
        const { service, events, evidence } = await build()

        await expect(service.reminder(REMINDER)).resolves.toBeUndefined()

        expect(evidence.reminder).toHaveBeenCalledWith(REMINDER)
        expect(events.resolved).not.toHaveBeenCalled()
    })

    it("logs and swallows a failure to announce a settled request: the request stands settled", async () => {
        const { service, events, logger } = await build()
        const cause = new Error("chain down")
        events.resolved.mockRejectedValue(cause)

        await expect(service.resolved(RESOLVED)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(ApprovalLogEvent.ResolvedEventFailed, cause, {
            requestId: "request-1",
        })
    })

    it("still tells the work chain when the evidence log fails", async () => {
        const { service, events, evidence, logger } = await build()
        const cause = new Error("log down")
        evidence.resolved.mockRejectedValue(cause)

        await expect(service.resolved(RESOLVED)).resolves.toBeUndefined()

        expect(events.resolved).toHaveBeenCalledWith(RESOLVED)
        expect(logger.error).toHaveBeenCalledWith(ApprovalLogEvent.ResolvedEventFailed, cause, {
            requestId: "request-1",
        })
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

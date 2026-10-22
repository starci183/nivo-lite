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
    events.reminder.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalAnnouncerService,
            { provide: LOGGER, useValue: logger },
            { provide: APPROVAL_EVENTS, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalAnnouncerService), events, logger }
}

describe("ApprovalAnnouncerService", () => {
    it("hands a settled request to the owner of the events port", async () => {
        const { service, events } = await build()

        await expect(service.resolved(RESOLVED)).resolves.toBeUndefined()

        expect(events.resolved).toHaveBeenCalledWith(RESOLVED)
    })

    it("hands the reminder of a request to the owner of the events port", async () => {
        const { service, events } = await build()

        await expect(service.reminder(REMINDER)).resolves.toBeUndefined()

        expect(events.reminder).toHaveBeenCalledWith(REMINDER)
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

    it("logs and swallows a failure to announce a reminder", async () => {
        const { service, events, logger } = await build()
        const cause = new Error("chain down")
        events.reminder.mockRejectedValue(cause)

        await expect(service.reminder(REMINDER)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(ApprovalLogEvent.ReminderEventFailed, cause, {
            requestId: "request-1",
        })
    })
})

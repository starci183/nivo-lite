import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalResolvedEvent, whenPresent } from "@modules/events/api"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalEvidenceService } from "./approval-evidence.service"

@Injectable()
/**
 * Tells the evidence log, then the event bus, what happened to a request. A settled request is announced inside the transaction that
 * settles it, so the evidence line and the `approval_resolved` event commit with it and a failure undoes the settling instead of
 * stranding the card. A reminder is written after its commit and a failing log is only logged.
 */
export class ApprovalAnnouncerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly evidence: ApprovalEvidenceService,
    ) {}

    /** Writes `approval.resolved` into the evidence log, then publishes `approval_resolved`, both in the caller's transaction. */
    async resolved(event: ApprovalResolved, tx: EntityManager): Promise<void> {
        await this.evidence.resolved(event, tx)
        const published = ApprovalResolvedEvent.create({
            requestId: event.requestId,
            workspaceId: event.workspaceId,
            outcome: event.outcome,
            ...whenPresent("decidedBy", event.decidedBy),
            action: event.action,
            chainStepId: event.chainStepId,
        })
        await this.bus.publish(published, tx, published.eventId)
    }

    /** Writes the one reminder of a request into the evidence log, which is where its approvers read it. */
    async reminder(event: ApprovalReminder): Promise<void> {
        try {
            await this.evidence.reminder(event)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.ReminderEventFailed, cause, { requestId: event.requestId })
        }
    }
}

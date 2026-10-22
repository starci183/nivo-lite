import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { InjectApprovalEvents } from "./approval-requests.decorators"
import type { ApprovalEvents } from "./approval-requests.port"

@Injectable()
/**
 * Tells the work chain what happened to a request. The request is settled (or reminded) in the database before this runs, so a
 * failing owner of the events port is logged and never undoes it.
 */
export class ApprovalAnnouncerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectApprovalEvents() private readonly events: ApprovalEvents,
    ) {}

    /** Publishes `approval.resolved`. */
    async resolved(event: ApprovalResolved): Promise<void> {
        try {
            await this.events.resolved(event)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.ResolvedEventFailed, cause, { requestId: event.requestId })
        }
    }

    /** Publishes the one reminder of a request. */
    async reminder(event: ApprovalReminder): Promise<void> {
        try {
            await this.events.reminder(event)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.ReminderEventFailed, cause, { requestId: event.requestId })
        }
    }
}

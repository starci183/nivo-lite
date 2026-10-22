import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { InjectApprovalEvents } from "./approval-requests.decorators"
import type { ApprovalEvents } from "./approval-requests.port"
import { ApprovalEvidenceService } from "./approval-evidence.service"

@Injectable()
/**
 * Tells the evidence log, then the work chain, what happened to a request. The request is settled (or reminded) in the database
 * before this runs, so a failing log or owner of the events port is logged and never undoes it, nor keeps the other from hearing.
 */
export class ApprovalAnnouncerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectApprovalEvents() private readonly events: ApprovalEvents,
        private readonly evidence: ApprovalEvidenceService,
    ) {}

    /** Writes `approval.resolved` into the evidence log, then publishes it to the work chain. */
    async resolved(event: ApprovalResolved): Promise<void> {
        await this.attempt(() => this.evidence.resolved(event), event.requestId)
        await this.attempt(() => this.events.resolved(event), event.requestId)
    }

    /** Writes the one reminder of a request into the evidence log, which is where its approvers read it. */
    async reminder(event: ApprovalReminder): Promise<void> {
        try {
            await this.evidence.reminder(event)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.ReminderEventFailed, cause, { requestId: event.requestId })
        }
    }

    private async attempt(publish: () => Promise<void>, requestId: string): Promise<void> {
        try {
            await publish()
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.ResolvedEventFailed, cause, { requestId })
        }
    }
}

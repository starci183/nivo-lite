import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"

/** Who the lines of the tick are written as, and the language they are written in: no person is reading when they are written. */
const NIVO_ACTOR = "NIVO"
const LINE_LOCALE: Locale = "vi"

/** The message key of the line that tells how a request ended. */
const RESOLVED_KEY = {
    approved: "approvals.resolved-approved",
    rejected: "approvals.resolved-rejected",
    expired: "approvals.resolved-expired",
} as const

@Injectable()
/**
 * The evidence log of the requests: every settled request and every reminder becomes a line of it, which is the one source the
 * decision history and the execution chain panel read. It is written before the work chain hears of a settled request.
 */
export class ApprovalEvidenceService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly events: EventsService,
    ) {}

    /** Writes `approval.resolved` into the evidence log. */
    async resolved(event: ApprovalResolved): Promise<void> {
        const nobody = event.outcome === "expired" && event.escalatedTo === null
        const key = nobody ? "approvals.resolved-expired-nobody" : RESOLVED_KEY[event.outcome]
        await this.events.record({
            workspaceId: event.workspaceId,
            kind: "approval.resolved",
            actor: event.decidedByName ?? NIVO_ACTOR,
            summary: this.catalog.get(key, { action: event.action, owner: event.escalatedTo?.name ?? "" }, LINE_LOCALE),
            evidence: JSON.stringify({
                requestId: event.requestId,
                chainStepId: event.chainStepId,
                outcome: event.outcome,
                decidedBy: event.decidedBy,
                escalatedTo: event.escalatedTo?.memberId ?? null,
            }),
        })
    }

    /** Writes `approval.reminder` into the evidence log. */
    async reminder(event: ApprovalReminder): Promise<void> {
        await this.events.record({
            workspaceId: event.workspaceId,
            kind: "approval.reminder",
            actor: NIVO_ACTOR,
            summary: this.catalog.get(
                "approvals.reminder",
                { action: event.action, names: event.remaining.map((member) => member.name).join(", ") },
                LINE_LOCALE,
            ),
            evidence: JSON.stringify({ requestId: event.requestId, chainStepId: event.chainStepId }),
        })
    }
}

import { Injectable } from "@nestjs/common"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { LeadMemoryService, leadMemorySubjectOf } from "@modules/domain/lead-memory"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentDoorsLogEvent } from "./agent-doors.log-events"
import type { CareOptOutAnswer, CareOptOutView } from "./agent-doors.contracts"
import { DoorPressesService } from "./door-presses.service"

/** The door an opt-out press is recorded under. */
const OPT_OUT = "care.opt_out"

/** The lead fact care and the customer sends read: true when nobody writes to the customer unprompted. */
const CARE_OPT_OUT = "careOptOut"

@Injectable()
/**
 * The shop's own door to a customer's care opt-out (until now only the customer's words set it): an owner or a manager sets or clears
 * `careOptOut` in the customer's lead memory, the one fact the care steps and the customer-send guard already read, so nothing else
 * changes. Every press is recorded with who and when; the view answers the fact as it stands and the last press.
 */
export class CareOptOutService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly memory: LeadMemoryService,
        private readonly presses: DoorPressesService,
    ) {}

    /** The opt-out of a customer as it stands, or null when the workspace has no such customer. Owner or manager only. */
    async read(userId: string, workspaceId: string, leadId: string): Promise<CareOptOutView | null> {
        await this.access.manager(userId, workspaceId)
        return this.viewOf(workspaceId, leadId)
    }

    /** Sets (true) or clears (false) the customer's opt-out. Owner or manager only; the press is recorded. */
    async set(userId: string, workspaceId: string, leadId: string, optOut: boolean): Promise<CareOptOutAnswer> {
        const memberId = await this.access.manager(userId, workspaceId)
        const before = await this.optedOutOf(workspaceId, leadId)
        if (before === null) return { outcome: "not_found", view: null }
        await this.memory.remember(workspaceId, leadMemorySubjectOf(leadId, null), { [CARE_OPT_OUT]: optOut })
        const outcome = before === optOut ? "unchanged" : "set"
        const member = await this.members.require(userId, workspaceId)
        await this.presses.record({
            workspaceId,
            door: OPT_OUT,
            subject: leadId,
            memberId,
            memberName: member.displayName,
            outcome,
            detail: { optOut },
        })
        this.logger.info(AgentDoorsLogEvent.CareOptOutSet, { optOut, outcome })
        return { outcome, view: await this.viewOf(workspaceId, leadId) }
    }

    private async viewOf(workspaceId: string, leadId: string): Promise<CareOptOutView | null> {
        const optedOut = await this.optedOutOf(workspaceId, leadId)
        if (optedOut === null) return null
        return { leadId, optedOut, lastPress: await this.presses.latest(workspaceId, OPT_OUT, leadId) }
    }

    /** Whether the customer is opted out (the fact is `true`), or null when the workspace has no such customer. */
    private async optedOutOf(workspaceId: string, leadId: string): Promise<boolean | null> {
        const snapshot = await this.memory.snapshot(workspaceId, leadMemorySubjectOf(leadId, null), "step")
        return snapshot === null ? null : snapshot.lead[CARE_OPT_OUT] === true
    }
}

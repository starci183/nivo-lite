import { Injectable } from "@nestjs/common"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { isDomainError } from "@modules/platform/errors"
import { refusalOfDecision } from "./team-chat-decision.policy"
import type { DecideOutcome, DecideVerdict } from "./team-chat-decision.policy"
import { TeamChatRoomsService } from "./team-chat.service"

@Injectable()
/**
 * Settles one decision from any of its cards through the decisions core, the same door the workbench pane uses, so the rights, the
 * policy (any, all, sequential) and the events that resume the waiting run are the core's. Every card of the decision reads its state live,
 * so all of them show the outcome at once.
 */
export class TeamChatDecisionService {
    constructor(
        private readonly requests: ApprovalRequestsService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly chat: TeamChatRoomsService,
    ) {}

    /** Settles the decision as the seat of the caller and answers the state the cards now show, or why the verdict was refused. */
    async decide(
        workspaceId: string,
        userId: string,
        decisionId: string,
        verdict: DecideVerdict,
    ): Promise<DecideOutcome> {
        const seat = await this.seats.activeSeatOfUser(workspaceId, userId)
        if (seat === null) return { ok: false, refusal: "not_an_approver" }
        try {
            await this.requests.decide({ requestId: decisionId, memberId: seat.memberId, verdict })
        } catch (cause) {
            const refusal = isDomainError(cause) ? refusalOfDecision(cause.code) : null
            if (refusal === null) throw cause
            return { ok: false, refusal }
        }
        const approval = await this.chat.approvalOf(workspaceId, userId, decisionId)
        return approval === null ? { ok: false, refusal: "decision_not_found" } : { ok: true, approval }
    }
}

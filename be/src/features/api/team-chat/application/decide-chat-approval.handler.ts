import { CommandHandler } from "@nestjs/cqrs"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { TeamChatService } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isDomainError } from "@modules/platform/errors"
import { DecideChatApprovalCommand } from "./decide-chat-approval.command"
import { refusalOfDecision } from "./decide-chat-approval.policy"
import type { DecideOutcome } from "./team-chat.contracts"

@CommandHandler(DecideChatApprovalCommand)
/**
 * Settles one decision from any of its cards through the decisions core, the same door the workbench pane uses, so the rights, the
 * policy (any, all, sequential) and the events that resume the waiting run are the core's. Every card of the decision reads its state live,
 * so all of them show the outcome at once.
 */
export class DecideChatApprovalHandler extends ICQRSHandler<DecideChatApprovalCommand, DecideOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly requests: ApprovalRequestsService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override async process(command: DecideChatApprovalCommand): Promise<DecideOutcome> {
        const { principal, request } = command.params
        const seat = await this.seats.activeSeatOfUser(request.workspaceId, principal.id)
        if (seat === null) return { ok: false, refusal: "not_an_approver" }
        try {
            await this.requests.decide({
                requestId: request.decisionId,
                memberId: seat.memberId,
                verdict: request.verdict,
            })
        } catch (cause) {
            const refusal = isDomainError(cause) ? refusalOfDecision(cause.code) : null
            if (refusal === null) throw cause
            return { ok: false, refusal }
        }
        const approval = await this.chat.approvalOf(request.workspaceId, principal.id, request.decisionId)
        return approval === null ? { ok: false, refusal: "decision_not_found" } : { ok: true, approval }
    }
}

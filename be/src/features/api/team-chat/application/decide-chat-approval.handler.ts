import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatDecisionService } from "@modules/domain/team-chat"
import type { DecideOutcome } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideChatApprovalCommand } from "./decide-chat-approval.command"

@CommandHandler(DecideChatApprovalCommand)
/** Settles one decision from any of its cards through the decisions core; the service holds the seat, the verdict and the refusals. */
export class DecideChatApprovalHandler extends ICQRSHandler<DecideChatApprovalCommand, DecideOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: TeamChatDecisionService,
    ) {
        super(logger)
    }

    protected override process(command: DecideChatApprovalCommand): Promise<DecideOutcome> {
        return this.decisions.decide(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.decisionId,
            command.params.request.verdict,
        )
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { ChatApprovalDecisionService } from "@modules/domain/agent-pages"
import type { DecideOutcome } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecideChatApprovalCommand } from "./decide-chat-approval.command"

@CommandHandler(DecideChatApprovalCommand)
/** The verdict on an approval card: the capability refuses it `decision_not_found`, since no road opens an approval card any more. */
export class DecideChatApprovalHandler extends ICQRSHandler<DecideChatApprovalCommand, DecideOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: ChatApprovalDecisionService,
    ) {
        super(logger)
    }

    protected override process(_command: DecideChatApprovalCommand): Promise<DecideOutcome> {
        return this.decisions.decide()
    }
}

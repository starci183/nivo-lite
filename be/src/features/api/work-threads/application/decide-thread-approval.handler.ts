import { CommandHandler } from "@nestjs/cqrs"
import { ThreadApprovalsService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideThreadApprovalCommand } from "./decide-thread-approval.command"

@CommandHandler(DecideThreadApprovalCommand)
/** Approves or rejects the card of a thread message through one domain-service call. */
export class DecideThreadApprovalHandler extends ICQRSHandler<DecideThreadApprovalCommand, ThreadMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly approvals: ThreadApprovalsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideThreadApprovalCommand): Promise<ThreadMessage> {
        return this.approvals.decide({ ...command.params.request, userId: command.params.principal.id })
    }
}

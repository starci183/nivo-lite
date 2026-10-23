import { CommandHandler } from "@nestjs/cqrs"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideThreadApprovalCommand } from "./decide-thread-approval.command"

@CommandHandler(DecideThreadApprovalCommand)
/** Approves or rejects the card of a thread message; the agent that asked goes on (one domain call). */
export class DecideThreadApprovalHandler extends ICQRSHandler<DecideThreadApprovalCommand, ThreadMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly work: ThreadWorkService,
    ) {
        super(logger)
    }

    protected override process(command: DecideThreadApprovalCommand): Promise<ThreadMessage> {
        return this.work.decide({ ...command.params.request, userId: command.params.principal.id })
    }
}

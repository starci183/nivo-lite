import { CommandHandler } from "@nestjs/cqrs"
import { ThreadApprovalOutcomesService } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SettleApprovalOutcomeCommand } from "./settle-approval-outcome.command"

@CommandHandler(SettleApprovalOutcomeCommand)
/** Hands the delivered approval_resolved event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class SettleApprovalOutcomeHandler extends ICQRSHandler<SettleApprovalOutcomeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly outcomes: ThreadApprovalOutcomesService,
    ) {
        super(logger)
    }

    protected override process(command: SettleApprovalOutcomeCommand): Promise<void> {
        return this.outcomes.resolved(command.params.request.delivery.event.payload, {
            consumer: command.params.request.delivery.consumer,
            dedupeKey: command.params.request.delivery.dedupeKey,
        })
    }
}

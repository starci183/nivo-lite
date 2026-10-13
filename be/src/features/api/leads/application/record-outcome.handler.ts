import { CommandHandler } from "@nestjs/cqrs"
import { LeadsService } from "@modules/domain/leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecordOutcomeCommand } from "./record-outcome.command"
import type { RecordOutcomeResult } from "./record-outcome.contracts"

@CommandHandler(RecordOutcomeCommand)
/** Records the outcome of the journey of a lead through one domain-service call. */
export class RecordOutcomeHandler extends ICQRSHandler<RecordOutcomeCommand, RecordOutcomeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadsService: LeadsService,
    ) {
        super(logger)
    }

    protected override process(command: RecordOutcomeCommand): Promise<RecordOutcomeResult> {
        return this.leadsService.recordOutcome({ ...command.params.request, userId: command.params.principal.id })
    }
}

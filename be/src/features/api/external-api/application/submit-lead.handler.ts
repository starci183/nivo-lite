import { CommandHandler } from "@nestjs/cqrs"
import { PublicLeadsService } from "@modules/domain/public-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SubmitLeadResult } from "./submit-lead.contracts"
import { SubmitLeadCommand } from "./submit-lead.command"

@CommandHandler(SubmitLeadCommand)
/** Hands a customer over through one domain-service call that admits the key first; the follow-up work is a job. */
export class SubmitLeadHandler extends ICQRSHandler<SubmitLeadCommand, SubmitLeadResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: PublicLeadsService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitLeadCommand): Promise<SubmitLeadResult> {
        return this.leads.acceptLead(command.params.request)
    }
}

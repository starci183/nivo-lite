import { CommandHandler } from "@nestjs/cqrs"
import { InboxLeadsService } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignInboxLeadCommand } from "./assign-inbox-lead.command"

@CommandHandler(AssignInboxLeadCommand)
/** Hands the customer over through the inbox leads service, which proves the owner or manager role. */
export class AssignInboxLeadHandler extends ICQRSHandler<AssignInboxLeadCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: InboxLeadsService,
    ) {
        super(logger)
    }

    protected override process(command: AssignInboxLeadCommand): Promise<void> {
        return this.leads.assign(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.leadId,
            command.params.request.agentId,
        )
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphApprovalsService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SettleGraphAskCommand } from "./settle-graph-ask.command"

@CommandHandler(SettleGraphAskCommand)
/** Hands the delivered approval_resolved event to the approvals service of the graphs, which settles the item and is safe to run twice. */
export class SettleGraphAskHandler extends ICQRSHandler<SettleGraphAskCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly approvals: AgentGraphApprovalsService,
    ) {
        super(logger)
    }

    protected override process(command: SettleGraphAskCommand): Promise<void> {
        return this.approvals.ended(command.params.request.delivery.event.payload)
    }
}

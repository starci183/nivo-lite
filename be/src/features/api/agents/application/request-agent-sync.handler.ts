import { CommandHandler } from "@nestjs/cqrs"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestAgentSyncCommand } from "./request-agent-sync.command"

@CommandHandler(RequestAgentSyncCommand)
/** Queues the sync through the sync service. */
export class RequestAgentSyncHandler extends ICQRSHandler<RequestAgentSyncCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sync: AgentSyncService,
    ) {
        super(logger)
    }

    protected override process(command: RequestAgentSyncCommand): Promise<void> {
        return this.sync.requestFor(command.params.principal.id, command.params.request)
    }
}

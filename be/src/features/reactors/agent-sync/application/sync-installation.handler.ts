import { CommandHandler } from "@nestjs/cqrs"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SyncInstallationCommand } from "./sync-installation.command"

@CommandHandler(SyncInstallationCommand)
/** Hands the delivered installation_changed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class SyncInstallationHandler extends ICQRSHandler<SyncInstallationCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sync: AgentSyncService,
    ) {
        super(logger)
    }

    protected override process(command: SyncInstallationCommand): Promise<void> {
        return this.sync.installationChanged(command.params.request.delivery.event.payload, {
            consumer: command.params.request.delivery.consumer,
            dedupeKey: command.params.request.delivery.dedupeKey,
        })
    }
}

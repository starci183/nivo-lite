import { CommandHandler } from "@nestjs/cqrs"
import { DataHubService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetSyncScheduleCommand } from "./set-sync-schedule.command"

@CommandHandler(SetSyncScheduleCommand)
/** Sets how often a data connection syncs by itself through the DataHubService. */
export class SetSyncScheduleHandler extends ICQRSHandler<SetSyncScheduleCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly hub: DataHubService,
    ) {
        super(logger)
    }

    protected override async process(command: SetSyncScheduleCommand): Promise<void> {
        const { workspaceId, connectionId, everyMinutes } = command.params.request
        await this.hub.owner({ principalId: command.params.principal.id, workspaceId })
        await this.hub.own(workspaceId, connectionId)
        await this.hub.setSchedule(workspaceId, connectionId, everyMinutes)
    }
}

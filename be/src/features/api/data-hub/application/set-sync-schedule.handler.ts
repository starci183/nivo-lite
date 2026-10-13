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

    protected override process(command: SetSyncScheduleCommand): Promise<void> {
        return this.hub.changeSchedule(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.everyMinutes,
        )
    }
}

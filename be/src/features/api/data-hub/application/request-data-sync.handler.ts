import { CommandHandler } from "@nestjs/cqrs"
import { DataSyncService } from "@modules/domain/data-hub"
import type { DataSyncRun } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestDataSyncCommand } from "./request-data-sync.command"

@CommandHandler(RequestDataSyncCommand)
/** Queues one sync of a data connection through the DataSyncService. */
export class RequestDataSyncHandler extends ICQRSHandler<RequestDataSyncCommand, DataSyncRun> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sync: DataSyncService,
    ) {
        super(logger)
    }

    protected override process(command: RequestDataSyncCommand): Promise<DataSyncRun> {
        return this.sync.request(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}

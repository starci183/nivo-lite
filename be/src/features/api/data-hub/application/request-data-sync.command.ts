import { Command } from "@nestjs/cqrs"
import type { DataSyncRun } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestDataSyncRequest } from "./request-data-sync.contracts"

/** Queues one sync of a data connection now, whatever its schedule says. */
export class RequestDataSyncCommand extends Command<DataSyncRun> {
    constructor(readonly params: ExecuteParams<RequestDataSyncRequest>) {
        super()
    }
}

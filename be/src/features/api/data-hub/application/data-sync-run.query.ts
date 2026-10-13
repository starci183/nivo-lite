import { Query } from "@nestjs/cqrs"
import type { DataSyncRun } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DataSyncRunRequest } from "./data-sync-run.contracts"

/** Asks how one sync run of a data connection is going. */
export class DataSyncRunQuery extends Query<DataSyncRun> {
    constructor(readonly params: ExecuteParams<DataSyncRunRequest>) {
        super()
    }
}

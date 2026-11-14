import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RecordModuleView } from "@modules/domain/workbench-door"
import type { RecordTypesRequest } from "./record-types.contracts"

/** Reads the record types of the workspace's installed agents, with the reads and actions that reach them. */
export class RecordTypesQuery extends Query<ReadonlyArray<RecordModuleView>> {
    constructor(readonly params: ExecuteParams<RecordTypesRequest>) {
        super()
    }
}

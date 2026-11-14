import { Query } from "@nestjs/cqrs"
import type { CallLogView } from "@modules/domain/tools"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ToolCallLogRequest } from "./tool-call-log.contracts"

/** Asks for the latest gateway audit lines (secrets masked). */
export class ToolCallLogQuery extends Query<ReadonlyArray<CallLogView>> {
    constructor(readonly params: ExecuteParams<ToolCallLogRequest>) {
        super()
    }
}

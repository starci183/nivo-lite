import { Query } from "@nestjs/cqrs"
import type { CallLogView } from "@modules/domain/mcp-gateway"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMcpCallLogRequest } from "./list-mcp-call-log.contracts"

/** Asks for the latest gateway audit lines (secrets masked). */
export class ListMcpCallLogQuery extends Query<ReadonlyArray<CallLogView>> {
    constructor(readonly params: ExecuteParams<ListMcpCallLogRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { ConnectorView } from "@modules/domain/mcp-gateway"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMcpConnectorsRequest } from "./list-mcp-connectors.contracts"

/** Asks for the gateway connectors of the workspace with their tools. */
export class ListMcpConnectorsQuery extends Query<ReadonlyArray<ConnectorView>> {
    constructor(readonly params: ExecuteParams<ListMcpConnectorsRequest>) {
        super()
    }
}

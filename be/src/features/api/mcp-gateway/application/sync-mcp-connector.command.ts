import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SyncMcpConnectorRequest } from "./sync-mcp-connector.contracts"

/** Reads a remote connector's tools/list into its catalog. */
export class SyncMcpConnectorCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<SyncMcpConnectorRequest>) {
        super()
    }
}

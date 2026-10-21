import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckMcpConnectorRequest } from "./check-mcp-connector.contracts"

/** Checks that a remote connector answers MCP and records its status. */
export class CheckMcpConnectorCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<CheckMcpConnectorRequest>) {
        super()
    }
}

import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RegisterMcpConnectorRequest } from "./register-mcp-connector.contracts"

/** Registers a remote MCP server as a gateway connector. */
export class RegisterMcpConnectorCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RegisterMcpConnectorRequest>) {
        super()
    }
}

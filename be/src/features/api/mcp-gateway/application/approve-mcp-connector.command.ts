import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApproveMcpConnectorRequest } from "./approve-mcp-connector.contracts"

/** Approves the live tool catalog of a remote connector, exactly as it was read. */
export class ApproveMcpConnectorCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<ApproveMcpConnectorRequest>) {
        super()
    }
}

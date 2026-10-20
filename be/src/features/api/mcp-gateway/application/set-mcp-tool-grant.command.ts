import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetMcpToolGrantRequest } from "./set-mcp-tool-grant.contracts"

/** Sets one agent's grant of a gateway tool. */
export class SetMcpToolGrantCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetMcpToolGrantRequest>) {
        super()
    }
}

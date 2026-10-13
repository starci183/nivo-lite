import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GrantAgentConnectionRequest } from "./grant-agent-connection.contracts"

/** Asks to grant a connection to an agent or change the grant. */
export class GrantAgentConnectionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<GrantAgentConnectionRequest>) {
        super()
    }
}

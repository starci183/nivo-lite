import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeAgentConnectionRequest } from "./revoke-agent-connection.contracts"

/** Asks to remove the grant of a connection to an agent. */
export class RevokeAgentConnectionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RevokeAgentConnectionRequest>) {
        super()
    }
}

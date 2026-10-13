import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentConnectionsRequest } from "./set-agent-connections.contracts"

/** Makes an agent use exactly these connections. */
export class SetAgentConnectionsCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentConnectionsRequest>) {
        super()
    }
}

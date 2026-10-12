import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentConnectionsRequest, SetAgentConnectionsResult } from "./set-agent-connections.contracts"

/** Makes exactly these connections the ones an agent uses (owner only). */
export class SetAgentConnectionsCommand extends Command<SetAgentConnectionsResult> {
    constructor(readonly params: ExecuteParams<SetAgentConnectionsRequest>) {
        super()
    }
}

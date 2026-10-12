import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetConnectionAgentsRequest, SetConnectionAgentsResult } from "./set-connection-agents.contracts"

/** Makes exactly these agents the users of a connection (owner only). */
export class SetConnectionAgentsCommand extends Command<SetConnectionAgentsResult> {
    constructor(readonly params: ExecuteParams<SetConnectionAgentsRequest>) {
        super()
    }
}

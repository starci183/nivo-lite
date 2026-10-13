import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetConnectionAgentsRequest } from "./set-connection-agents.contracts"

/** Makes exactly these agents use a connection. */
export class SetConnectionAgentsCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetConnectionAgentsRequest>) {
        super()
    }
}

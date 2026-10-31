import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentGraphModeRequest } from "./set-agent-graph-mode.contracts"

/** Sets whether the graph of one agent decides or only records. */
export class SetAgentGraphModeCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentGraphModeRequest>) {
        super()
    }
}

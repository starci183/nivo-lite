import { Command } from "@nestjs/cqrs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RestoreAgentGraphVersionRequest } from "./restore-agent-graph-version.contracts"

/** Publishes an older version of the graph of one agent again as a new one. */
export class RestoreAgentGraphVersionCommand extends Command<GraphVersionView> {
    constructor(readonly params: ExecuteParams<RestoreAgentGraphVersionRequest>) {
        super()
    }
}

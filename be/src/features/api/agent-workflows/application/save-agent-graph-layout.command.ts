import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentGraphLayoutResult } from "./agent-graph-layout.contracts"
import type { SaveAgentGraphLayoutRequest } from "./save-agent-graph-layout.contracts"

/** Replaces where each workflow sits on the Graph page of one installation. */
export class SaveAgentGraphLayoutCommand extends Command<AgentGraphLayoutResult> {
    constructor(readonly params: ExecuteParams<SaveAgentGraphLayoutRequest>) {
        super()
    }
}

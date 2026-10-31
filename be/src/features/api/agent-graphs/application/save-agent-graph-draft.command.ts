import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveAgentGraphDraftRequest } from "./save-agent-graph-draft.contracts"

/** Saves the draft of the graph of one agent under the revision the editor read. */
export class SaveAgentGraphDraftCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<SaveAgentGraphDraftRequest>) {
        super()
    }
}

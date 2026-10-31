import { Command } from "@nestjs/cqrs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConfirmAgentGraphProposalRequest } from "./confirm-agent-graph-proposal.contracts"

/** Confirms a learned proposal for the graph of one agent and publishes the change it makes as the next version. */
export class ConfirmAgentGraphProposalCommand extends Command<GraphVersionView> {
    constructor(readonly params: ExecuteParams<ConfirmAgentGraphProposalRequest>) {
        super()
    }
}

import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeclineAgentGraphProposalRequest } from "./decline-agent-graph-proposal.contracts"

/** Declines a proposal made for the graph of one agent. */
export class DeclineAgentGraphProposalCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeclineAgentGraphProposalRequest>) {
        super()
    }
}

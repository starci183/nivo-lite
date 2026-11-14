import { Query } from "@nestjs/cqrs"
import type { TemplateProposal } from "@modules/domain/tools"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentAbilityProposalRequest } from "./get-agent-ability-proposal.contracts"

/** Asks what a fresh agent of a module would be attached to in the workspace, from the module template. */
export class GetAgentAbilityProposalQuery extends Query<ReadonlyArray<TemplateProposal>> {
    constructor(readonly params: ExecuteParams<GetAgentAbilityProposalRequest>) {
        super()
    }
}

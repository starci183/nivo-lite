import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { TemplateProposal } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentAbilityProposalQuery } from "./get-agent-ability-proposal.query"

@QueryHandler(GetAgentAbilityProposalQuery)
/** Asks what a fresh agent of a module would be attached to in the workspace, pre-ticked from the module defaults. The admin service checks the owner or manager role. */
export class GetAgentAbilityProposalHandler extends ICQRSHandler<
    GetAgentAbilityProposalQuery,
    ReadonlyArray<TemplateProposal>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentAbilityProposalQuery): Promise<ReadonlyArray<TemplateProposal>> {
        return this.admin.abilityProposal(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.moduleKey,
        )
    }
}

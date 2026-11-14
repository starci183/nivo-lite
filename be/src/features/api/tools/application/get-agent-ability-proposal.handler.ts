import { QueryHandler } from "@nestjs/cqrs"
import { ToolsConsoleService, type TemplateProposal } from "@modules/domain/tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetAgentAbilityProposalQuery } from "./get-agent-ability-proposal.query"

@QueryHandler(GetAgentAbilityProposalQuery)
/** Asks what a fresh agent of a module would be attached to in the workspace, from the module template. The admin service checks the owner or manager role. */
export class GetAgentAbilityProposalHandler extends ICQRSHandler<
    GetAgentAbilityProposalQuery,
    ReadonlyArray<TemplateProposal>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: ToolsConsoleService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentAbilityProposalQuery): Promise<ReadonlyArray<TemplateProposal>> {
        return this.admin.attachmentProposal(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.moduleKey,
        )
    }
}

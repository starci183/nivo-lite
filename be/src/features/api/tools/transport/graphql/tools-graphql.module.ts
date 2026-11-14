import { Module } from "@nestjs/common"
import { ToolsApiModule } from "../../tools.module"
import { ConfigurableModuleClass } from "./tools-graphql.module-definition"
import { ToolCallLogResolver } from "./tool-call-log.resolver"
import { ListProviderRightsResolver } from "./list-provider-rights.resolver"
import { GetAgentAbilityProposalResolver } from "./get-agent-ability-proposal.resolver"
import { ListProviderTemplateCandidatesResolver } from "./list-provider-template-candidates.resolver"
import { AttachAgentProviderResolver } from "./attach-agent-provider.resolver"
import { DetachAgentProviderResolver } from "./detach-agent-provider.resolver"
import { AttachProviderByTemplateResolver } from "./attach-provider-by-template.resolver"

@Module({
    imports: [ToolsApiModule.register({})],
    providers: [
        ToolCallLogResolver,
        ListProviderRightsResolver,
        GetAgentAbilityProposalResolver,
        ListProviderTemplateCandidatesResolver,
        AttachAgentProviderResolver,
        DetachAgentProviderResolver,
        AttachProviderByTemplateResolver,
    ],
})
/** The GraphQL transport of the tools registry console. */
export class ToolsGraphqlModule extends ConfigurableModuleClass {}

import { Module } from "@nestjs/common"
import { ToolCallLogHandler } from "./application/tool-call-log.handler"
import { ListProviderRightsHandler } from "./application/list-provider-rights.handler"
import { GetAgentAbilityProposalHandler } from "./application/get-agent-ability-proposal.handler"
import { ListProviderTemplateCandidatesHandler } from "./application/list-provider-template-candidates.handler"
import { AttachAgentProviderHandler } from "./application/attach-agent-provider.handler"
import { DetachAgentProviderHandler } from "./application/detach-agent-provider.handler"
import { AttachProviderByTemplateHandler } from "./application/attach-provider-by-template.handler"
import { ConfigurableModuleClass } from "./tools.module-definition"

@Module({
    providers: [
        ToolCallLogHandler,
        ListProviderRightsHandler,
        GetAgentAbilityProposalHandler,
        ListProviderTemplateCandidatesHandler,
        AttachAgentProviderHandler,
        DetachAgentProviderHandler,
        AttachProviderByTemplateHandler,
    ],
})
/** The tools console feature: the provider board, the agents' account attachments (agent + connection, nothing ticked) and the tool call log. */
export class ToolsApiModule extends ConfigurableModuleClass {}

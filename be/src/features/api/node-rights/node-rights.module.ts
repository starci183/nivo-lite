import { Module } from "@nestjs/common"
import { GetAgentNodeRightsHandler } from "./application/get-agent-node-rights.handler"
import { GetAgentTemplateNodeRequestsHandler } from "./application/get-agent-template-node-requests.handler"
import { GetProviderRightHoldersHandler } from "./application/get-provider-right-holders.handler"
import { ConfigurableModuleClass } from "./node-rights.module-definition"

@Module({
    providers: [
        GetAgentNodeRightsHandler,
        GetProviderRightHoldersHandler,
        GetAgentTemplateNodeRequestsHandler,
    ],
})
/** The node rights feature: the read-only roll-ups of an agent's rights page and of a provider's rights tab. */
export class NodeRightsApiModule extends ConfigurableModuleClass {}

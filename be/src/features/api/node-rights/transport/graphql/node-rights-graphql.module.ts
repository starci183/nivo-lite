import { Module } from "@nestjs/common"
import { NodeRightsApiModule } from "../../node-rights.module"
import { GetAgentNodeRightsResolver } from "./get-agent-node-rights.resolver"
import { GetAgentTemplateNodeRequestsResolver } from "./get-agent-template-node-requests.resolver"
import { GetProviderRightHoldersResolver } from "./get-provider-right-holders.resolver"
import { ConfigurableModuleClass } from "./node-rights-graphql.module-definition"

@Module({
    imports: [NodeRightsApiModule.register({})],
    providers: [
        GetAgentNodeRightsResolver,
        GetProviderRightHoldersResolver,
        GetAgentTemplateNodeRequestsResolver,
    ],
})
/** The GraphQL transport of the node rights roll-ups: an agent's rights page and a provider's rights tab. */
export class NodeRightsGraphqlModule extends ConfigurableModuleClass {}

import { Module } from "@nestjs/common"
import { McpGatewayApiModule } from "../../mcp-gateway.module"
import { ConfigurableModuleClass } from "./mcp-gateway-graphql.module-definition"
import { ListMcpConnectorsResolver } from "./list-mcp-connectors.resolver"
import { ListMcpToolGrantsResolver } from "./list-mcp-tool-grants.resolver"
import { ListMcpCallLogResolver } from "./list-mcp-call-log.resolver"
import { SetMcpToolGrantResolver } from "./set-mcp-tool-grant.resolver"
import { RegisterMcpConnectorResolver } from "./register-mcp-connector.resolver"
import { SyncMcpConnectorResolver } from "./sync-mcp-connector.resolver"
import { ApproveMcpConnectorResolver } from "./approve-mcp-connector.resolver"
import { CheckMcpConnectorResolver } from "./check-mcp-connector.resolver"
import { SetMcpConnectorCredentialResolver } from "./set-mcp-connector-credential.resolver"
import { ListProviderRightsResolver } from "./list-provider-rights.resolver"
import { GetAgentAbilityProposalResolver } from "./get-agent-ability-proposal.resolver"
import { ListProviderTemplateCandidatesResolver } from "./list-provider-template-candidates.resolver"
import { AttachAgentProviderResolver } from "./attach-agent-provider.resolver"
import { DetachAgentProviderResolver } from "./detach-agent-provider.resolver"
import { SetAgentAbilityResolver } from "./set-agent-ability.resolver"
import { AttachProviderByTemplateResolver } from "./attach-provider-by-template.resolver"
import { SetDefaultReceivingAccountResolver } from "./set-default-receiving-account.resolver"

@Module({
    imports: [McpGatewayApiModule.register({})],
    providers: [
        ListMcpConnectorsResolver,
        ListMcpToolGrantsResolver,
        ListMcpCallLogResolver,
        SetMcpToolGrantResolver,
        RegisterMcpConnectorResolver,
        SyncMcpConnectorResolver,
        ApproveMcpConnectorResolver,
        CheckMcpConnectorResolver,
        SetMcpConnectorCredentialResolver,
        SetDefaultReceivingAccountResolver,
        ListProviderRightsResolver,
        GetAgentAbilityProposalResolver,
        ListProviderTemplateCandidatesResolver,
        AttachAgentProviderResolver,
        DetachAgentProviderResolver,
        SetAgentAbilityResolver,
        AttachProviderByTemplateResolver,
    ],
})
/** The GraphQL transport of the MCP gateway console. */
export class McpGatewayGraphqlModule extends ConfigurableModuleClass {}

import type { DynamicModule } from "@nestjs/common"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { AgentMessagesModule } from "@modules/domain/agent-messages"
import { AgentsModule } from "@modules/domain/agents"
import { BrainDossiersModule } from "@modules/domain/brain-dossiers"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { ConnectionsModule } from "@modules/domain/connections"
import { DossierReviewModule } from "@modules/domain/dossier-review"
import { KnowledgeModule } from "@modules/domain/knowledge"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesModule } from "@modules/domain/knowledge-sources"
import { McpGatewayModule } from "@modules/domain/mcp-gateway"
import { NativeToolsModule, NATIVE_TOOL_ADAPTERS } from "@modules/domain/native-tools"
import { NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { AiModule } from "@modules/integrations/ai"
import { MCP_CREDENTIAL_MODULES } from "./mcp-credential-capabilities.options"

/** True for the gateway the credential composition registers, which the native-tools composition replaces with one that has natives. */
const isGateway = (entry: DynamicModule): boolean => entry.module === McpGatewayModule

/**
 * The mcp app's composition with the native tools: the credential composition of the endpoint, the readers behind the tools in their
 * narrow modes (no AI key, so a search reads words), and the gateway given the native tool adapters.
 */
export const NATIVE_TOOLS_MODULES: ReadonlyArray<DynamicModule> = [
    ...MCP_CREDENTIAL_MODULES.filter((entry) => !isGateway(entry)),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    AiModule.register({
        isGlobal: true,
        gatewayUrl: null,
        virtualKey: null,
        chatModel: "work",
        embeddingModel: "embed",
    }),
    KnowledgeSourcesModule.register({ isGlobal: true, readOnly: true }),
    KnowledgeChunksModule.register({ isGlobal: true }),
    NivoKnowledgeModule.register({ isGlobal: true, searchOnly: true, folders: [] }),
    KnowledgeModule.register({ isGlobal: true, searchOnly: true }),
    BrainFactsModule.register({ isGlobal: true }),
    BrainDossiersModule.register({ isGlobal: true, readOnly: true }),
    DossierReviewModule.register({ isGlobal: true, readOnly: true }),
    ConnectionsModule.register({ isGlobal: true, readOnly: true }),
    AgentConversationsModule.register({ isGlobal: true, readOnly: true }),
    AgentMessagesModule.register({ isGlobal: true, readOnly: true }),
    NativeToolsModule.register({ isGlobal: true }),
    McpGatewayModule.register({
        isGlobal: true,
        remote: { clientName: "nivo-mcp-gateway" },
        defaultTimeoutMs: 4000,
        natives: NATIVE_TOOL_ADAPTERS,
    }),
]

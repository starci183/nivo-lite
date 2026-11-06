import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { BrainDossiersModule } from "@modules/domain/brain-dossiers"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { ChatRecordsModule } from "@modules/domain/chat-records"
import { ConnectionsModule } from "@modules/domain/connections"
import { DossierReviewModule } from "@modules/domain/dossier-review"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { KnowledgeModule } from "@modules/domain/knowledge"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesModule } from "@modules/domain/knowledge-sources"
import { ProviderRegistryModule } from "@modules/domain/provider-registry"
import { McpCallLogModule } from "@modules/domain/mcp-call-log"
import { McpGatewayModule } from "@modules/domain/mcp-gateway"
import { NativeToolsModule, NATIVE_TOOL_ADAPTERS } from "@modules/domain/native-tools"
import { NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { AiModule } from "@modules/integrations/ai"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_JOBS } from "@nivo-lite/blocks-core/modules"
import { MCP_CREDENTIAL_MODULES, MCP_PROOF_TOKEN_KEY } from "./mcp-credential-capabilities.options"
import { QUIET_INSTALLATIONS } from "./quiet-peers.options"

@Module({ providers: [QUIET_INSTALLATIONS], exports: [AGENTS_INSTALLATIONS] })
/** No proof installs a module, so no agent has an installation for the chat records to read. */
class NativeToolsProofInstallationsModule {}

/** True for the gateway the credential composition registers, which the native-tools composition replaces with one that has natives. */
const isGateway = (entry: DynamicModule): boolean => entry.module === McpGatewayModule

/**
 * The mcp app's composition with the native tools: the credential composition of the endpoint, the readers behind the tools in their
 * narrow modes (no AI key, so a search reads words), the chat records they read conversations from, and the gateway given the native
 * tool adapters.
 */
export const NATIVE_TOOLS_MODULES: ReadonlyArray<DynamicModule> = [
    ...MCP_CREDENTIAL_MODULES.filter((entry) => !isGateway(entry)),
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
    ConnectionsModule.readOnly({ isGlobal: true, readOnly: true }),
    { module: NativeToolsProofInstallationsModule, global: true },
    EntityEngineModule.register({
        isGlobal: true,
        alerts: ReadOnlyEngineAlertsService,
        entities: FLOW_F_ENTITIES,
        jobs: MODULE_JOBS,
        cursorKey: MCP_PROOF_TOKEN_KEY,
    }),
    ChatRecordsModule.register({ isGlobal: true }),
    AgentGraphsModule.register({ isGlobal: true, rightsOnly: true }),
    NativeToolsModule.register({ isGlobal: true }),
    ProviderRegistryModule.register({ isGlobal: true }),
    McpCallLogModule.register({ isGlobal: true }),
    McpGatewayModule.register({
        isGlobal: true,
        remote: { clientName: "nivo-mcp-gateway" },
        defaultTimeoutMs: 4000,
        natives: NATIVE_TOOL_ADAPTERS,
    }),
]

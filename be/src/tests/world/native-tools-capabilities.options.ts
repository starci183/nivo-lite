import { Module, type DynamicModule } from "@nestjs/common"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AGENTS_INSTALLATIONS, AgentDirectoryService } from "@modules/domain/agents"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { chatRecordsModules } from "./chat-records-modules"
import { ConnectionsModule } from "@modules/domain/connections"
import { KnowledgeModule } from "@modules/domain/knowledge"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesModule } from "@modules/domain/knowledge-sources"
import { ProviderRegistryModule } from "@modules/domain/provider-registry"
import { ToolCallLogModule } from "@modules/domain/tool-call-log"
import { ToolsModule } from "@modules/domain/tools"
import { NativeToolsModule, NATIVE_TOOL_ADAPTERS } from "@modules/domain/native-tools"
import { NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { AiModule } from "@modules/integrations/ai"
import { VECTOR_INDEX } from "@modules/integrations/qdrant"
import { FakeVectorIndex } from "@tests/fixtures/builders/vector-sync.builder"
import { MCP_CREDENTIAL_MODULES } from "./mcp-credential-capabilities.options"
import { QUIET_INSTALLATIONS } from "./quiet-peers.options"

@Module({ providers: [QUIET_INSTALLATIONS], exports: [AGENTS_INSTALLATIONS] })
/** No proof installs a module, so no agent has an installation for the chat records to read. */
class NativeToolsProofInstallationsModule {}

@Module({ providers: [{ provide: VECTOR_INDEX, useValue: new FakeVectorIndex() }], exports: [VECTOR_INDEX] })
/** The vector index of the proof (a required engine piece): in memory, empty, searched inside the mandatory filters. */
class NativeToolsProofVectorIndexModule {}

/** True for the gateway the credential composition registers, which the native-tools composition replaces with one that has natives. */
const isGateway = (entry: DynamicModule): boolean => entry.module === ToolsModule

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
    ConnectionsModule.readOnly({ isGlobal: true, readOnly: true }),
    { module: NativeToolsProofInstallationsModule, global: true },
    { module: NativeToolsProofVectorIndexModule, global: true },
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    ...chatRecordsModules(),
    AgentGraphsModule.register({ isGlobal: true, rightsOnly: true }),
    NativeToolsModule.register({ isGlobal: true }),
    ProviderRegistryModule.register({ isGlobal: true }),
    ToolCallLogModule.register({ isGlobal: true }),
    ToolsModule.register({
        isGlobal: true,
        defaultTimeoutMs: 4000,
        natives: NATIVE_TOOL_ADAPTERS,
    }),
]

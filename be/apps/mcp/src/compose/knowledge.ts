import type { DynamicModule } from "@nestjs/common"
import {
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_CONVERSATIONS_MESSAGES,
    AgentConversationsModule,
} from "@modules/domain/agent-conversations"
import { AGENT_MESSAGES_ERROR_KINDS, AGENT_MESSAGES_MESSAGES, AgentMessagesModule } from "@modules/domain/agent-messages"
import {
    BRAIN_DOSSIERS_ERROR_KINDS,
    BRAIN_DOSSIERS_MESSAGES,
    BrainDossiersModule,
} from "@modules/domain/brain-dossiers"
import { BRAIN_FACTS_ERROR_KINDS, BRAIN_FACTS_MESSAGES, BrainFactsModule } from "@modules/domain/brain-facts"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import {
    DOSSIER_REVIEW_ERROR_KINDS,
    DOSSIER_REVIEW_MESSAGES,
    DossierReviewModule,
} from "@modules/domain/dossier-review"
import { KNOWLEDGE_ERROR_KINDS, KNOWLEDGE_MESSAGES, KnowledgeModule } from "@modules/domain/knowledge"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import {
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    KNOWLEDGE_SOURCES_MESSAGES,
    KnowledgeSourcesModule,
} from "@modules/domain/knowledge-sources"
import {
    NIVO_KNOWLEDGE_ERROR_KINDS,
    NIVO_KNOWLEDGE_MESSAGES,
    NivoKnowledgeModule,
} from "@modules/domain/nivo-knowledge"
import { NativeToolsModule } from "@modules/domain/native-tools"
import { AiModule } from "@modules/integrations/ai"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
import type { McpAppOptions } from "../mcp.options"

/**
 * The readers behind the native tools of the door, each in its narrow mode: the Brain facts, the dossiers and their findings, the
 * passages of the business and base knowledge with the metered embedding of a question, the connections and the message feed. Nothing
 * here writes, indexes or queues. The AI endpoint is optional: without a key the search reads words.
 */
export const mcpKnowledgeModules = (options: McpAppOptions): Array<DynamicModule> => [
    HttpModule.register({ isGlobal: true }),
    AiModule.register({ isGlobal: true, ...options.ai }),
    KnowledgeSourcesModule.register({ isGlobal: true, readOnly: true }),
    KnowledgeChunksModule.register({ isGlobal: true }),
    NivoKnowledgeModule.register({ isGlobal: true, searchOnly: true, folders: [] }),
    KnowledgeModule.register({ isGlobal: true, searchOnly: true }),
    BrainFactsModule.register({ isGlobal: true }),
    BrainDossiersModule.register({ isGlobal: true, readOnly: true }),
    DossierReviewModule.register({ isGlobal: true, readOnly: true }),
    ConnectionsModule.readOnly({ isGlobal: true, readOnly: true }),
    AgentConversationsModule.register({ isGlobal: true, readOnly: true }),
    AgentMessagesModule.register({ isGlobal: true, readOnly: true }),
    NativeToolsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers. */
export const mcpKnowledgeErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_MESSAGES_ERROR_KINDS,
    BRAIN_DOSSIERS_ERROR_KINDS,
    BRAIN_FACTS_ERROR_KINDS,
    CONNECTIONS_ERROR_KINDS,
    DOSSIER_REVIEW_ERROR_KINDS,
    HTTP_ERROR_KINDS,
    KNOWLEDGE_ERROR_KINDS,
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    NIVO_KNOWLEDGE_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const mcpKnowledgeMessages: ReadonlyArray<MessageBundle> = [
    AGENT_CONVERSATIONS_MESSAGES,
    AGENT_MESSAGES_MESSAGES,
    BRAIN_DOSSIERS_MESSAGES,
    BRAIN_FACTS_MESSAGES,
    CONNECTIONS_MESSAGES,
    DOSSIER_REVIEW_MESSAGES,
    HTTP_MESSAGES,
    KNOWLEDGE_MESSAGES,
    KNOWLEDGE_SOURCES_MESSAGES,
    NIVO_KNOWLEDGE_MESSAGES,
]

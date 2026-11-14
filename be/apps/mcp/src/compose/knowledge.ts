import type { DynamicModule } from "@nestjs/common"
import {
    ENTITY_ENGINE_ERROR_KINDS,
    ENTITY_ENGINE_MESSAGES,
    EntityEngineModule,
    ReadOnlyEngineAlertsService,
} from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { BRAIN_ERROR_KINDS, BRAIN_MESSAGES, BrainModule } from "@modules/domain/brain"
import { BRAIN_FACTS_ERROR_KINDS, BRAIN_FACTS_MESSAGES, BrainFactsModule } from "@modules/domain/brain-facts"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { CONTACTS_ERROR_KINDS, CONTACTS_MESSAGES, ContactsModule } from "@modules/domain/contacts"
import { CUSTOMER_ROUTES_ERROR_KINDS, CUSTOMER_ROUTES_MESSAGES, CustomerRoutesModule } from "@modules/domain/customer-routes"
import { AiModule } from "@modules/integrations/ai"
import { chatProfileRoutes } from "@modules/integrations/ai-gateway"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
import type { McpAppOptions } from "../mcp.options"
import { WorkspaceSettingsModule } from "@modules/domain/workspace-settings"

/**
 * The records and knowledge the data ops read, registered as the api registers them, without the engine: the truths in force read by
 * words (the Brain's graph read alone: no write, no derivation, no vector), the connections a raw-data read opens, the entity engine
 * the workbench door reads and writes records through, the workspace's settings and the contacts. The AI endpoint is the readiness
 * probe's and the setup turn's client; nothing here embeds or searches by meaning.
 */
export const mcpKnowledgeModules = (options: McpAppOptions): Array<DynamicModule> => [
    HttpModule.register({ isGlobal: true }),
    AiModule.register({ isGlobal: true, ...options.ai, profileRoutes: chatProfileRoutes() }),
    BrainFactsModule.register({ isGlobal: true }),
    // The truths in force read by words (the data op `nivo.api.nivo.brain.search`): the graph read alone.
    BrainModule.register({ isGlobal: true, graphOnly: true }),
    ConnectionsModule.register({ isGlobal: true, ...options.connections, readOnly: false }),
    EntityEngineModule.register({
        isGlobal: true,
        entities: INSTALLED.entities(),
        jobs: [],
        alerts: ReadOnlyEngineAlertsService,
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
    // The workspace's own settings and its time zone, read from the core workspaces row.
    WorkspaceSettingsModule.register({ isGlobal: true }),
    // The contacts the contact ops read and decide on.
    ContactsModule.register({ isGlobal: true }),
    // The routes of the customers: the contact of a run's conversation is read from its route.
    CustomerRoutesModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers. */
export const mcpKnowledgeErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    ENTITY_ENGINE_ERROR_KINDS,
    BRAIN_ERROR_KINDS,
    BRAIN_FACTS_ERROR_KINDS,
    CONNECTIONS_ERROR_KINDS,
    CONTACTS_ERROR_KINDS,
    CUSTOMER_ROUTES_ERROR_KINDS,
    HTTP_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const mcpKnowledgeMessages: ReadonlyArray<MessageBundle> = [
    ENTITY_ENGINE_MESSAGES,
    BRAIN_MESSAGES,
    BRAIN_FACTS_MESSAGES,
    CONNECTIONS_MESSAGES,
    CONTACTS_MESSAGES,
    CUSTOMER_ROUTES_MESSAGES,
    HTTP_MESSAGES,
]

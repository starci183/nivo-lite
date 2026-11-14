// The directory leads: other capabilities import this barrel while it loads (import cycles), see AgentDirectoryService.
export { AgentDirectoryService } from "./agent-directory.service"
export { AgentDeletionPauseService } from "./agent-deletion-pause.service"
export { AgentViewScopeService } from "./agent-view-scope.service"
export { AGENTS_ERROR_KINDS } from "./errors/agents.error"
export { AGENTS_MESSAGES } from "./messages/agents.messages"
export { AGENTS_INSTALLATIONS, AGENTS_ROOMS, InjectInstallations } from "./agents.decorators"
export { AgentsModule } from "./agents.module"
export type {
    BaseRule,
    Installation,
    InstallationDirectory,
    KnowledgeDocument,
    KnowledgeLens,
    OptionalContextVersion,
    OptionalInstallation,
} from "./agents.port"
export { AgentCatalogService } from "./agent-catalog.service"
export type { CatalogAgent } from "./agent-catalog.contracts"
export { AgentLensesService } from "./agent-lenses.service"
export { AgentsService } from "./agents.service"
export type { AgentCard, AgentHeader, AgentViewScope } from "./agent-directory.contracts"
export { AgentIdentityService } from "./agent-identity.service"
export { AGENT_IDENTITY_RULES } from "./agent-name.policy"
export { AgentOwnershipService } from "./agent-ownership.service"
export { AgentRecordsService } from "./agent-records.service"
export { PauseClient } from "./pause.client"
export type {
    AgentDashboardData,
    AgentSummary,
    AgentAudience,
    AgentKnowledgeLens,
    LensCounts,
    LensLanes,
    OptionalId,
    OptionalOpenGaps,
    AgentTexts,
    AgentOwnership,
    Region,
} from "./agents.contracts"
export type { AskAsAgentInput, AskedPassage } from "./agent-ask.contracts"
export { agentsEntities } from "./persistence/entities"
export type {
    AgentKnowledgeOverview,
    KnowledgeDocumentOverview,
    KnowledgeLayer,
    KnowledgeLayerOverview,
    LensOverview,
    OwnFactOverview,
} from "./agent-knowledge-overview.contracts"

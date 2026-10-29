// The directory leads: other capabilities import this barrel while it loads (office-rooms <-> agents), see AgentDirectoryService.
export { AgentDirectoryModule } from "./agent-directory.module"
export { AgentDirectoryService } from "./agent-directory.service"
export { AGENTS_ERROR_KINDS } from "./errors/agents.error"
export { AGENTS_MESSAGES } from "./messages/agents.messages"
export { AgentBundleService } from "./agent-bundle.service"
export { AGENTS_INSTALLATIONS, InjectInstallations } from "./agents.decorators"
export { AgentsModule } from "./agents.module"
export { AGENTS_SYNC_FRESH_MS } from "./agents.options"
export type {
    BaseRule,
    Installation,
    InstallationDirectory,
    InstallationRef,
    KnowledgeDocument,
    KnowledgeLens,
    ModuleProfiles,
    OptionalContextVersion,
    OptionalInstallation,
} from "./agents.port"
export { AgentLensesService } from "./agent-lenses.service"
export { AgentsService } from "./agents.service"
export type { AgentCard, AgentHandleCard, AgentHeader, AgentLens, AgentSheet } from "./agent-directory.contracts"
export { AgentIdentityService } from "./agent-identity.service"
export { AgentOwnershipService } from "./agent-ownership.service"
export { AgentRecordsService } from "./agent-records.service"
export { EngineStatusService } from "./engine-status.service"
export { processorFromSettings, replyTimeoutSec } from "./engine-status.policy"
export { PauseClient } from "./pause.client"
export type {
    AgentBundle,
    AgentDashboardData,
    AgentSummary,
    AgentAudience,
    AgentKnowledgeLens,
    LensCounts,
    LensLanes,
    OptionalId,
    OptionalOpenGaps,
    OptionalAgentText,
    AgentTexts,
    EngineStatus,
    AgentProfile,
    AgentOwnership,
    Region,
} from "./agents.contracts"
export type { AskAsAgentInput, AskedPassage } from "./agent-ask.contracts"
export { agentsEntities } from "./persistence/entities"

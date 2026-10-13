export { AGENTS_ERROR_KINDS, AgentsError, AgentsErrorCode } from "./errors/agents.error"
export { AGENTS_MESSAGES } from "./messages/agents.messages"
export { AgentBundleService } from "./agent-bundle.service"
export { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE, AGENTS_MODULES, InjectInstallations } from "./agents.decorators"
export { AgentsModule } from "./agents.module"
export { AGENTS_SYNC_FRESH_MS } from "./agents.options"
export type { AgentsOptions, AgentsPorts } from "./agents.options"
export type {
    BaseRule,
    ContextGate,
    ContextVersion,
    Installation,
    InstallationDirectory,
    InstallationRef,
    KnowledgeDocument,
    KnowledgeLens,
    ModuleProfiles,
    OptionalContextVersion,
    OptionalInstallation,
} from "./agents.port"
export { AgentsService } from "./agents.service"
export { EngineStatusService } from "./engine-status.service"
export { processorFromSettings, replyTimeoutSec } from "./engine-status.policy"
export { PauseClient } from "./pause.client"
export type {
    AgentBundle,
    AgentDashboardData,
    AgentRef,
    AgentSummary,
    AgentTexts,
    DashboardQuery,
    EngineStatus,
    NewAgent,
    OptionalAgentRef,
    Processor,
} from "./agents.contracts"
export { UnboundInstallationsService } from "./unbound-installations.service"
export { UnboundKnowledgeLensService } from "./unbound-knowledge-lens.service"
export { UnboundModuleProfilesService } from "./unbound-module-profiles.service"

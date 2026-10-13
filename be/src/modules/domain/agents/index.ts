export { AGENTS_ERROR_KINDS } from "./errors/agents.error"
export { AGENTS_MESSAGES } from "./messages/agents.messages"
export { AgentBundleService } from "./agent-bundle.service"
export { AGENTS_INSTALLATIONS, InjectInstallations } from "./agents.decorators"
export { AgentsModule } from "./agents.module"
export { AGENTS_SYNC_FRESH_MS } from "./agents.options"
export type {
    Installation,
    InstallationDirectory,
    InstallationRef,
    OptionalContextVersion,
    OptionalInstallation,
} from "./agents.port"
export { AgentsService } from "./agents.service"
export { EngineStatusService } from "./engine-status.service"
export { processorFromSettings } from "./engine-status.policy"
export { PauseClient } from "./pause.client"
export type {
    AgentBundle,
    AgentDashboardData,
    AgentSummary,
    AgentTexts,
    EngineStatus,
    AgentProfile,
} from "./agents.contracts"
export { UnboundKnowledgeLensService } from "./unbound-knowledge-lens.service"
export { UnboundModuleProfilesService } from "./unbound-module-profiles.service"

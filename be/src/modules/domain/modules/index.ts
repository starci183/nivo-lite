export type {
    CatalogModule,
    InstallationView,
    ModuleDefinition,
    ModuleTrigger,
    OpenCatalog,
} from "./modules.contracts"
export { MODULES_ERROR_KINDS } from "./errors/modules.error"
export { MODULES_MESSAGES } from "./messages/modules.messages"
export { MODULE_CATEGORIES } from "./categories.contracts"
export { MODULE_CATALOG, MODULE_KNOWLEDGE_FOLDERS } from "./modules.catalog.contracts"
export { ModulesModule } from "./modules.module"
export { InstallationDirectoryService } from "./installation-directory.service"
export type { InstallRequest, InstallResult } from "./module-installs.contracts"
export type { CardDecision, SetupState, SetupVersions } from "./module-setup.contracts"
export { AgentActivationService } from "./agent-activation.service"
export { AgentRemovalService } from "./agent-removal.service"
export type { AgentRemovalImpact } from "./agent-removal.service"
export { AGENT_RECORDS } from "./agent-records.port"
export type { AgentRecordsErasure, AgentRecordsFootprint, AgentRecordsPort } from "./agent-records.port"
export { AgentRenameService } from "./agent-rename.service"
export { ModuleInstallService } from "./module-install.service"
export { ModuleAccessService } from "./module-access.service"
export { ModuleReadinessService } from "./module-readiness.service"
export { ModulesService } from "./modules.service"
export { SetupCardsService } from "./setup-cards.service"
export { SetupChatService } from "./setup-chat.service"
export { SetupTurnService } from "./setup-turn.service"
export { WorkspaceSetupService } from "./workspace-setup.service"
export { modulesEntities } from "./persistence/entities"
export { SETUP_GRAPH } from "./modules.decorators"
export type { SetupApplicant, SetupApplier, SetupGraphPort } from "./modules.port"
export { holdsCustomerAt, nextOnDutyAt, workingHoursOf } from "./policies/working-hours.policy"

import { Module } from "@nestjs/common"
import { ModulesApiModule } from "../../modules.module"
import { AgentSyncStatusResolver } from "./agent-sync-status.resolver"
import { ApplySetupResolver } from "./apply-setup.resolver"
import { ContextNotesResolver } from "./context-notes.resolver"
import { DismissContextNoteResolver } from "./dismiss-context-note.resolver"
import { DecideSetupCardResolver } from "./decide-setup-card.resolver"
import { InstallModuleResolver } from "./install-module.resolver"
import { InstanceOfRecordResolver } from "./instance-of-record.resolver"
import { ModuleDefinitionResolver } from "./module-definition.resolver"
import { ModuleInstallationResolver } from "./module-installation.resolver"
import { ModuleInstallationsResolver } from "./module-installations.resolver"
import { ModuleRequirementFactsResolver } from "./module-requirement-facts.resolver"
import { ModulesCatalogResolver } from "./modules-catalog.resolver"
import { ConfigurableModuleClass } from "./modules-graphql.module-definition"
import { PostSetupMessageResolver } from "./post-setup-message.resolver"
import { RenameInstallationAgentResolver } from "./rename-installation-agent.resolver"
import { RenameModuleInstallationResolver } from "./rename-module-installation.resolver"
import { SaveHoldingMessageResolver } from "./save-holding-message.resolver"
import { SaveReplyTimeoutResolver } from "./save-reply-timeout.resolver"
import { SetModuleLiveResolver } from "./set-module-live.resolver"
import { SetOperatingModeResolver } from "./set-operating-mode.resolver"
import { SetSetupGateResolver } from "./set-setup-gate.resolver"
import { SetupStateResolver } from "./setup-state.resolver"
import { SetupVersionsResolver } from "./setup-versions.resolver"

@Module({
    imports: [ModulesApiModule.register({})],
    providers: [
        ModulesCatalogResolver,
        ModuleDefinitionResolver,
        ModuleInstallationsResolver,
        ModuleInstallationResolver,
        AgentSyncStatusResolver,
        ModuleRequirementFactsResolver,
        InstallModuleResolver,
        InstanceOfRecordResolver,
        RenameModuleInstallationResolver,
        RenameInstallationAgentResolver,
        SetOperatingModeResolver,
        SetModuleLiveResolver,
        SaveReplyTimeoutResolver,
        SaveHoldingMessageResolver,
        SetupStateResolver,
        SetupVersionsResolver,
        PostSetupMessageResolver,
        SetSetupGateResolver,
        ApplySetupResolver,
        ContextNotesResolver,
        DismissContextNoteResolver,
        DecideSetupCardResolver,
    ],
})
/** The GraphQL transport of the modules feature. */
export class ModulesGraphqlModule extends ConfigurableModuleClass {}

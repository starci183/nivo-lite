import { Module } from "@nestjs/common"
import { ApplySetupHandler } from "./application/apply-setup.handler"
import { ContextNotesHandler } from "./application/context-notes.handler"
import { DismissContextNoteHandler } from "./application/dismiss-context-note.handler"
import { DecideSetupCardHandler } from "./application/decide-setup-card.handler"
import { GetAgentSyncStatusHandler } from "./application/get-agent-sync-status.handler"
import { GetCatalogHandler } from "./application/get-catalog.handler"
import { GetInstallationHandler } from "./application/get-installation.handler"
import { GetModuleHandler } from "./application/get-module.handler"
import { GetRequirementFactsHandler } from "./application/get-requirement-facts.handler"
import { GetSetupStateHandler } from "./application/get-setup-state.handler"
import { InstallModuleHandler } from "./application/install-module.handler"
import { InstanceOfRecordHandler } from "./application/instance-of-record.handler"
import { ListInstallationsHandler } from "./application/list-installations.handler"
import { ListSetupVersionsHandler } from "./application/list-setup-versions.handler"
import { PostSetupMessageHandler } from "./application/post-setup-message.handler"
import { RemoveAgentHandler } from "./application/remove-agent.handler"
import { RenameInstallationAgentHandler } from "./application/rename-installation-agent.handler"
import { RenameInstallationHandler } from "./application/rename-installation.handler"
import { SaveInstallationSettingHandler } from "./application/save-installation-setting.handler"
import { SetModuleLiveHandler } from "./application/set-module-live.handler"
import { SetOperatingModeHandler } from "./application/set-operating-mode.handler"
import { SetSetupGateHandler } from "./application/set-setup-gate.handler"
import { ConfigurableModuleClass } from "./modules.module-definition"

@Module({
    providers: [
        ApplySetupHandler,
        ContextNotesHandler,
        DismissContextNoteHandler,
        DecideSetupCardHandler,
        GetAgentSyncStatusHandler,
        GetCatalogHandler,
        GetInstallationHandler,
        GetModuleHandler,
        GetRequirementFactsHandler,
        GetSetupStateHandler,
        InstallModuleHandler,
        InstanceOfRecordHandler,
        ListInstallationsHandler,
        ListSetupVersionsHandler,
        PostSetupMessageHandler,
        RemoveAgentHandler,
        RenameInstallationAgentHandler,
        RenameInstallationHandler,
        SaveInstallationSettingHandler,
        SetModuleLiveHandler,
        SetOperatingModeHandler,
        SetSetupGateHandler,
    ],
})
/** The modules feature: the handlers that read the catalogue and run the lifecycle and the setup chat of the installed agents. */
export class ModulesApiModule extends ConfigurableModuleClass {}

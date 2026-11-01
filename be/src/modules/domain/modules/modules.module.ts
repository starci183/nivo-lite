import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ModuleContextVersionsModule } from "@modules/domain/module-context-versions"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { ModuleSetupMessagesModule } from "@modules/domain/module-setup-messages"
import { ContextNotesModule } from "@modules/domain/module-context-notes"
import { ModuleSetupSessionsModule } from "@modules/domain/module-setup-sessions"
import { ModuleSetupWritesModule } from "@modules/domain/module-setup-writes"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./modules.module-definition"
import { AgentActivationService } from "./agent-activation.service"
import { AgentRemovalService } from "./agent-removal.service"
import { AgentRenameService } from "./agent-rename.service"
import { InstallationChangesService } from "./installation-changes.service"
import { InstallationDirectoryService } from "./installation-directory.service"
import { InstallationFactsService } from "./installation-facts.service"
import { ModuleInstallService } from "./module-install.service"
import { ModuleReadinessService } from "./module-readiness.service"
import { RECORD_INSTALLATION_SOURCES } from "./modules.decorators"
import type { RecordInstallationSource } from "./modules.port"
import { ModulesService } from "./modules.service"
import { RecordInstallationService } from "./record-installation.service"
import { SetupBranchCardsService } from "./setup-branch-cards.service"
import { SetupCardsService } from "./setup-cards.service"
import { SetupGraphService } from "./setup-graph.service"
import { SetupChatService } from "./setup-chat.service"
import { SetupTurnService } from "./setup-turn.service"
import { WorkspaceSetupService } from "./workspace-setup.service"

@Module({})
/**
 * The modules capability: the typed catalogue of installable agents, its mirror in the database and the lifecycle of the installed
 * agents. It brings the tables of the installations and of their setup chat, which only this lifecycle reads and writes.
 */
export class ModulesModule extends ConfigurableModuleClass {
    /**
     * Registers the capability once per app with the catalogue the app root names. The catalog-only and setup-only modes register
     * fewer real providers and nothing in their place.
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.catalogOnly === true) {
            return { ...base, providers: [...(base.providers ?? []), ModulesService], exports: [ModulesService] }
        }
        const setup = [
            ModulesService,
            ModuleReadinessService,
            InstallationDirectoryService,
            InstallationChangesService,
            SetupChatService,
            SetupCardsService,
            SetupBranchCardsService,
            SetupGraphService,
        ]
        const providers =
            options.setupOnly === true
                ? setup
                : [
                      ...setup,
                      AgentActivationService,
                      AgentRenameService,
                      AgentRemovalService,
                      ModuleInstallService,
                      InstallationFactsService,
                      RecordInstallationService,
                      SetupTurnService,
                      WorkspaceSetupService,
                  ]
        const sessions = ModuleSetupSessionsModule.register({})
        const tables = [
            ModuleInstallationsModule.register({}),
            ModuleContextVersionsModule.register({}),
            sessions,
            ContextNotesModule.register({ sessions }),
            ModuleSetupMessagesModule.register({ sessions }),
            ModuleSetupWritesModule.register({}),
        ]
        const sources = {
            provide: RECORD_INSTALLATION_SOURCES,
            useFactory: (...owners: Array<RecordInstallationSource>) => owners,
            inject: [...(options.ports?.recordSources ?? [])],
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), ...tables],
            providers: [...(base.providers ?? []), ...providers, ...(options.setupOnly === true ? [] : [sources])],
            exports: [...providers, ...tables],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ModuleContextVersionsModule } from "@modules/domain/module-context-versions"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { ModuleSetupMessagesModule } from "@modules/domain/module-setup-messages"
import { ContextNotesModule } from "@modules/domain/module-context-notes"
import { ModuleSetupSessionsModule } from "@modules/domain/module-setup-sessions"
import { ModuleSetupWritesModule } from "@modules/domain/module-setup-writes"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./modules.module-definition"
import { InstallationDirectoryService } from "./installation-directory.service"
import { ModuleInstallService } from "./module-install.service"
import { ModuleReadinessService } from "./module-readiness.service"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
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
            SetupChatService,
            SetupCardsService,
        ]
        const providers =
            options.setupOnly === true
                ? setup
                : [...setup, ModuleInstallService, SetupTurnService, WorkspaceSetupService]
        const tables = [
            ModuleInstallationsModule.register({}),
            ModuleContextVersionsModule.register({}),
            ModuleSetupSessionsModule.register({}),
            ContextNotesModule.register({}),
            ModuleSetupMessagesModule.register({}),
            ModuleSetupWritesModule.register({}),
        ]
        return {
            ...base,
            imports: [...(base.imports ?? []), ...tables],
            providers: [...(base.providers ?? []), ...providers],
            exports: [...providers, ...tables],
        }
    }
}

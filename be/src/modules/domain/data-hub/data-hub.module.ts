import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DataSyncModule } from "@modules/queues/data-sync"
import { ContractImportService } from "./contract-import.service"
import { CsvImportSyncService } from "./csv-import-sync.service"
import { CsvImportWizardService } from "./csv-import-wizard.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-hub.module-definition"
import { DataHubService } from "./data-hub.service"
import { DataSyncService } from "./data-sync.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DatabaseWizardService } from "./database-wizard.service"
import { ImapSyncService } from "./imap-sync.service"
import { ImapWizardService } from "./imap-wizard.service"
import { OpenApiSyncService } from "./openapi-sync.service"
import { OpenApiWizardService } from "./openapi-wizard.service"
import { TelegramUserSyncService } from "./telegram-user-sync.service"
import { TelegramUserWizardService } from "./telegram-user-wizard.service"

@Module({})
/** The data hub: what a workspace's own systems hold (a database, an API, an import, a mailbox, a personal Telegram), the wizards that connect them and the syncs that read them. */
export class DataHubModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), DataSyncModule.register({})],
            providers: [
                ...(base.providers ?? []),
                DataHubService,
                DataSyncService,
                CsvImportWizardService,
                CsvImportSyncService,
                ContractImportService,
                DatabaseWizardService,
                DatabaseSyncService,
                ImapWizardService,
                ImapSyncService,
                OpenApiWizardService,
                OpenApiSyncService,
                TelegramUserWizardService,
                TelegramUserSyncService,
            ],
            exports: [
                ContractImportService,
                DataHubService,
                DataSyncService,
                CsvImportWizardService,
                DatabaseWizardService,
                ImapWizardService,
                OpenApiWizardService,
                TelegramUserWizardService,
            ],
        }
    }
}

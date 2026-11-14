import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { DataSyncModule } from "@modules/queues/data-sync"
import { CsvImportSyncService } from "./csv-import-sync.service"
import { CsvImportWizardService } from "./csv-import-wizard.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-hub.module-definition"
import { DataHubService } from "./data-hub.service"
import { DataSyncService } from "./data-sync.service"
import { DataSyncTriggerService } from "./data-sync-trigger.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DatabaseWizardService } from "./database-wizard.service"
import { ImapSyncService } from "./imap-sync.service"
import { IMAP_MAIL_TRIGGER } from "./imap-mail.trigger"
import { ImapWizardService } from "./imap-wizard.service"
import { OpenApiToolsOperatorService } from "./openapi-tools-operator.service"
import { CrmConnectService } from "./crm-connect.service"
import { OpenApiToolsPinService } from "./openapi-tools-pin.service"
import { TelegramUserSyncService } from "./telegram-user-sync.service"
import { TelegramUserWizardService } from "./telegram-user-wizard.service"

@Module({})
/** The data hub: what a workspace's own systems hold (a database, an API, an import, a mailbox, a personal Telegram), the wizards that connect them and the syncs that read them. */
export class DataHubModule extends ConfigurableModuleClass implements OnModuleInit {
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
                DataSyncTriggerService,
                CsvImportWizardService,
                CsvImportSyncService,
                DatabaseWizardService,
                DatabaseSyncService,
                ImapWizardService,
                ImapSyncService,
                OpenApiToolsPinService,
                CrmConnectService,
                TelegramUserWizardService,
                TelegramUserSyncService,
            ],
            exports: [
                DataHubService,
                DataSyncService,
                CsvImportWizardService,
                DatabaseWizardService,
                ImapWizardService,
                OpenApiToolsPinService,
                CrmConnectService,
                TelegramUserWizardService,
            ],
        }
    }

    /**
     * Registers only the pin of an OpenAPI document and its terminal door, for the cli app: the owner check, the pin and the
     * operator's report. No wizard, no sync and no queue: the cli connects to nothing outside.
     */
    static pinOnly(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [DataHubService, OpenApiToolsPinService, OpenApiToolsOperatorService]
        return { ...base, providers: [...(base.providers ?? []), ...services], exports: services }
    }

    /** Registers the mailbox's trigger once. */
    onModuleInit(): void {
        triggerDeclarations.register(IMAP_MAIL_TRIGGER)
    }
}

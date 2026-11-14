import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { DATABASE_SANDBOX_CATALOGUE } from "./database-sandbox.catalogue"
import { DatabaseSandboxSyncService } from "./database-sandbox-sync.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DataConnectorRegistryService } from "./data-connector-registry.service"
import { TELEGRAM_USER_SANDBOX_CATALOGUE } from "./telegram-user-sandbox.catalogue"
import { TelegramUserSandboxSyncService } from "./telegram-user-sandbox-sync.service"
import { TelegramUserSyncService } from "./telegram-user-sync.service"

@Injectable()
/**
 * Hands the owner's database pull and the personal Telegram pull (each live and sandbox) to the data connector registry and their
 * sandbox catalogues to the sandbox page's registry, once, when the app starts. (The mailbox's is `ImapConnectorRegistrationService`.)
 */
export class DataConnectorRegistrationService implements OnModuleInit {
    constructor(
        private readonly connectors: DataConnectorRegistryService,
        private readonly databaseLive: DatabaseSyncService,
        private readonly databaseSandbox: DatabaseSandboxSyncService,
        private readonly telegramLive: TelegramUserSyncService,
        private readonly telegramSandbox: TelegramUserSandboxSyncService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both connectors under `database` and under `telegram_user`, and the two catalogues. */
    onModuleInit(): void {
        this.connectors.register({ live: this.databaseLive, sandbox: this.databaseSandbox })
        this.connectors.register({ live: this.telegramLive, sandbox: this.telegramSandbox })
        this.catalogues.register(DATABASE_SANDBOX_CATALOGUE)
        this.catalogues.register(TELEGRAM_USER_SANDBOX_CATALOGUE)
    }
}

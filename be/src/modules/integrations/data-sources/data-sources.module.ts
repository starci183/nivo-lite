import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DATABASE, IMAP, OPENAPI, PUBLIC_HOST, TABLE, TELEGRAM_USER } from "./data-sources.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-sources.module-definition"
import { DatabaseClient } from "./database.client"
import { ImapClient } from "./imap.client"
import { OpenApiClient } from "./openapi.client"
import { PublicHostClient } from "./public-host.client"
import { TableClient } from "./table.client"
import { TelegramUserClient } from "./telegram-user.client"

@Module({})
/** Provides the clients that read the owner's own systems: a database, a mailbox, an API, a personal Telegram, a table or document. */
export class DataSourcesModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that syncs a workspace's own systems. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: PUBLIC_HOST, useClass: PublicHostClient },
                { provide: IMAP, useClass: ImapClient },
                { provide: DATABASE, useClass: DatabaseClient },
                { provide: OPENAPI, useClass: OpenApiClient },
                { provide: TELEGRAM_USER, useClass: TelegramUserClient },
                { provide: TABLE, useClass: TableClient },
            ],
            exports: [IMAP, DATABASE, OPENAPI, TELEGRAM_USER, TABLE, PUBLIC_HOST],
        }
    }
}

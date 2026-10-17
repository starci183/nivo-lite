import { LeadGenIntakeService } from "@modules/domain/lead-flows"
import type { DynamicModule } from "@nestjs/common"
import { ConnectionsModule } from "@modules/domain/connections"
import { DataHubModule } from "@modules/domain/data-hub"
import { DataRecordsModule } from "@modules/domain/data-records"
import { DataSyncRunsModule } from "@modules/domain/data-sync-runs"
import { DataSourcesModule } from "@modules/integrations/data-sources"
import { TelegramUserModule } from "@modules/integrations/telegram-user"
import { ConnectionGrantsModule } from "@modules/domain/connection-grants"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { WebhookConnectionsModule } from "@modules/domain/webhook-connections"
import { GoogleConnectionsModule } from "@modules/domain/google-connections"
import { MetaConnectionsModule } from "@modules/domain/meta-connections"
import { MetaInboxModule } from "@modules/domain/meta-inbox"
import { ConnectionLifecycleModule } from "@modules/domain/connection-lifecycle"
import { ConnectionCommandsModule } from "@modules/domain/connection-commands"
import { GoogleModule } from "@modules/integrations/google"
import { MetaModule } from "@modules/integrations/meta"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { WebhookDeliveryModule } from "@modules/integrations/webhook-delivery"
import { DOCUMENT_FILE_READERS } from "@modules/integrations/documents"
import { TELEGRAM_USER_ERRORS } from "../api.options"
import type { ApiOptions } from "../api.options"
/** The connections area of the API, in registration order. */
export const connectionsModules = (options: ApiOptions): Array<DynamicModule> => [
    ConnectionsModule.register({ isGlobal: true, ...options.connections }),
    ConnectionGrantsModule.register({ isGlobal: true }),
    DataSourcesModule.register({ isGlobal: true, ...options.dataSources, documentReaders: DOCUMENT_FILE_READERS }),
    TelegramUserModule.register({ isGlobal: true, ...options.telegramUser, errors: TELEGRAM_USER_ERRORS }),
    DataRecordsModule.register({ isGlobal: true }),
    DataSyncRunsModule.register({ isGlobal: true }),
    DataHubModule.register({ isGlobal: true }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    WebhookConnectionsModule.register({ isGlobal: true, ...options.webhookConnections }),
    GoogleConnectionsModule.register({ isGlobal: true }),
    MetaConnectionsModule.register({ isGlobal: true }),
    MetaInboxModule.register({ isGlobal: true, taker: LeadGenIntakeService }),
    ConnectionLifecycleModule.register({ isGlobal: true }),
    ConnectionCommandsModule.register({ isGlobal: true }),
    GoogleModule.register({ isGlobal: true, ...options.google }),
    MetaModule.register({ isGlobal: true, ...options.meta }),
    ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
    WebhookDeliveryModule.register({ isGlobal: true, ...options.webhookDelivery }),
]

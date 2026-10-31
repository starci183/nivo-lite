import { LEAD_FLOWS_ERROR_KINDS, LEAD_FLOWS_MESSAGES, LeadGenIntakeService } from "@modules/domain/lead-flows"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { DynamicModule } from "@nestjs/common"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { DATA_HUB_ERROR_KINDS, DATA_HUB_MESSAGES, DataHubModule } from "@modules/domain/data-hub"
import { DataRecordsModule } from "@modules/domain/data-records"
import { DataSyncRunsModule } from "@modules/domain/data-sync-runs"
import { DATA_SOURCES_ERROR_KINDS, DataSourcesModule } from "@modules/integrations/data-sources"
import { TelegramUserModule } from "@modules/integrations/telegram-user"
import {
    CONNECTION_GRANTS_ERROR_KINDS,
    CONNECTION_GRANTS_MESSAGES,
    ConnectionGrantsModule,
} from "@modules/domain/connection-grants"
import {
    CHANNEL_CONNECTIONS_ERROR_KINDS,
    CHANNEL_CONNECTIONS_MESSAGES,
    ChannelConnectionsModule,
} from "@modules/domain/channel-connections"
import {
    WEBHOOK_CONNECTIONS_ERROR_KINDS,
    WEBHOOK_CONNECTIONS_MESSAGES,
    WebhookConnectionsModule,
} from "@modules/domain/webhook-connections"
import {
    GOOGLE_CONNECTIONS_ERROR_KINDS,
    GOOGLE_CONNECTIONS_MESSAGES,
    GoogleConnectionsModule,
} from "@modules/domain/google-connections"
import {
    META_CONNECTIONS_ERROR_KINDS,
    META_CONNECTIONS_MESSAGES,
    MetaConnectionsModule,
} from "@modules/domain/meta-connections"
import { META_INBOX_ERROR_KINDS, META_INBOX_MESSAGES, MetaInboxModule } from "@modules/domain/meta-inbox"
import { ConnectionLifecycleModule } from "@modules/domain/connection-lifecycle"
import { ConnectionCommandsModule } from "@modules/domain/connection-commands"
import { GOOGLE_ERROR_KINDS, GOOGLE_MESSAGES, GoogleModule } from "@modules/integrations/google"
import { META_ERROR_KINDS, META_MESSAGES, MetaModule } from "@modules/integrations/meta"
import {
    CHANNEL_SETUP_ERROR_KINDS,
    CHANNEL_SETUP_MESSAGES,
    ChannelSetupModule,
} from "@modules/integrations/channel-setup"
import {
    WEBHOOK_DELIVERY_ERROR_KINDS,
    WEBHOOK_DELIVERY_MESSAGES,
    WebhookDeliveryModule,
} from "@modules/integrations/webhook-delivery"
import { DOCUMENT_FILE_READERS, DOCUMENTS_ERROR_KINDS, DOCUMENTS_MESSAGES } from "@modules/integrations/documents"
import { TELEGRAM_USER_ERRORS } from "../api.options"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The connections area of the API, in registration order. */
export const connectionsModules = (options: ApiOptions): Array<DynamicModule> => [
    ConnectionsModule.register({
        isGlobal: true,
        ...options.connections,
        readOnly: false,
        ports: { agents: AgentBindingsService },
    }),
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

/** The error kinds of the capabilities this group registers, in registration order. */
export const connectionsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    CONNECTIONS_ERROR_KINDS,
    DATA_HUB_ERROR_KINDS,
    DATA_SOURCES_ERROR_KINDS,
    CONNECTION_GRANTS_ERROR_KINDS,
    CHANNEL_CONNECTIONS_ERROR_KINDS,
    WEBHOOK_CONNECTIONS_ERROR_KINDS,
    GOOGLE_CONNECTIONS_ERROR_KINDS,
    META_CONNECTIONS_ERROR_KINDS,
    META_INBOX_ERROR_KINDS,
    GOOGLE_ERROR_KINDS,
    META_ERROR_KINDS,
    CHANNEL_SETUP_ERROR_KINDS,
    WEBHOOK_DELIVERY_ERROR_KINDS,
    DOCUMENTS_ERROR_KINDS,
    LEAD_FLOWS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const connectionsMessages: ReadonlyArray<MessageBundle> = [
    DOCUMENTS_MESSAGES,
    CONNECTIONS_MESSAGES,
    DATA_HUB_MESSAGES,
    CONNECTION_GRANTS_MESSAGES,
    CHANNEL_CONNECTIONS_MESSAGES,
    WEBHOOK_CONNECTIONS_MESSAGES,
    GOOGLE_CONNECTIONS_MESSAGES,
    META_CONNECTIONS_MESSAGES,
    META_INBOX_MESSAGES,
    GOOGLE_MESSAGES,
    META_MESSAGES,
    CHANNEL_SETUP_MESSAGES,
    WEBHOOK_DELIVERY_MESSAGES,
    LEAD_FLOWS_MESSAGES,
]

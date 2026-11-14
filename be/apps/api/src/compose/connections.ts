import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { DynamicModule, Type } from "@nestjs/common"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { DATA_HUB_ERROR_KINDS, DATA_HUB_MESSAGES, DataHubModule } from "@modules/domain/data-hub"
import { ACCOUNT_DATA_ERROR_KINDS, ACCOUNT_DATA_MESSAGES, AccountDataModule } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "@modules/domain/account-data-catalog"
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
    MoneyConnectionFieldsService,
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
import { CONNECTION_FIELDS_ERROR_KINDS, CONNECTION_FIELDS_MESSAGES, ConnectionFieldsModule, type ConnectionFieldWriter } from "@modules/domain/connection-fields"
import { ZaloConnectionFieldsService } from "@modules/domain/channels"
import { SmtpConnectionFieldsService } from "@modules/domain/email-messages"
import { ConnectionFieldsGraphqlModule } from "@features/api/connection-fields"
import { INET_ERROR_KINDS, INET_MESSAGES, InetModule } from "@modules/integrations/inet"
import { TINO_ERROR_KINDS, TINO_MESSAGES, TinoModule } from "@modules/integrations/tino"
import { PAYOS_ERROR_KINDS, PAYOS_MESSAGES, PayosModule } from "@modules/integrations/payos"
import { ELEVENLABS_ERROR_KINDS, ELEVENLABS_MESSAGES, ElevenLabsModule } from "@modules/integrations/elevenlabs"
import { VEO_ERROR_KINDS, VEO_MESSAGES, VeoModule } from "@modules/integrations/veo"
import { GOOGLE_CALENDAR_ERROR_KINDS, GOOGLE_CALENDAR_MESSAGES, GoogleCalendarModule } from "@modules/integrations/google-calendar"
import { META_PUBLISHING_ERROR_KINDS, META_PUBLISHING_MESSAGES, MetaPublishingModule } from "@modules/integrations/meta-publishing"
import { YOUTUBE_ERROR_KINDS, YOUTUBE_MESSAGES, YoutubeModule } from "@modules/integrations/youtube"
import { TIKTOK_ERROR_KINDS, TIKTOK_MESSAGES, TiktokModule } from "@modules/integrations/tiktok"
import { MISA_AMIS_ERROR_KINDS, MISA_AMIS_MESSAGES, MisaAmisModule } from "@modules/integrations/misa-amis"
import { MISA_MEINVOICE_ERROR_KINDS, MISA_MEINVOICE_MESSAGES, MisaMeinvoiceModule } from "@modules/integrations/misa-meinvoice"
import { SHOTSTACK_ERROR_KINDS, SHOTSTACK_MESSAGES, ShotstackModule } from "@modules/integrations/shotstack"
import { CREATOMATE_ERROR_KINDS, CREATOMATE_MESSAGES, CreatomateModule } from "@modules/integrations/creatomate"
import { JSON2VIDEO_ERROR_KINDS, JSON2VIDEO_MESSAGES, Json2VideoModule } from "@modules/integrations/json2video"
import { VideoComposeModule } from "@modules/domain/video-compose"
import { ShotstackConnectionFieldsService, ShotstackProviderModule } from "@modules/domain/shotstack-provider"
import { CreatomateConnectionFieldsService, CreatomateProviderModule } from "@modules/domain/creatomate-provider"
import { Json2VideoConnectionFieldsService, Json2VideoProviderModule } from "@modules/domain/json2video-provider"
import { InetProviderModule } from "@modules/domain/inet-provider"
import { TinoProviderModule } from "@modules/domain/tino-provider"
import { PayosProviderModule } from "@modules/domain/payos-provider"
import { ElevenLabsConnectionFieldsService, ElevenLabsProviderModule } from "@modules/domain/elevenlabs-provider"
import { VeoConnectionFieldsService, VeoProviderModule } from "@modules/domain/veo-provider"
import { GoogleCalendarProviderModule } from "@modules/domain/google-calendar-provider"
import { MetaPublishingProviderModule } from "@modules/domain/meta-publishing-provider"
import { YoutubeProviderModule } from "@modules/domain/youtube-provider"
import { TiktokConnectionFieldsService, TiktokProviderModule } from "@modules/domain/tiktok-provider"
import { MisaAmisProviderModule } from "@modules/domain/misa-amis-provider"
import { MisaMeinvoiceProviderModule } from "@modules/domain/misa-meinvoice-provider"
import { TELEGRAM_USER_ERRORS, type ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The writers of the generic connection form, one per provider capability that registers one. */
export const CONNECTION_FIELD_WRITER_CLASSES: ReadonlyArray<Type<ConnectionFieldWriter>> = [
    MoneyConnectionFieldsService,
    ZaloConnectionFieldsService,
    SmtpConnectionFieldsService,
    ElevenLabsConnectionFieldsService,
    VeoConnectionFieldsService,
    TiktokConnectionFieldsService,
    ShotstackConnectionFieldsService,
    CreatomateConnectionFieldsService,
    Json2VideoConnectionFieldsService,
]

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
    AccountDataModule.register({ isGlobal: true, types: ACCOUNT_DATA_CATALOG }),
    DataRecordsModule.register({ isGlobal: true }),
    DataSyncRunsModule.register({ isGlobal: true }),
    DataHubModule.register({ isGlobal: true }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    WebhookConnectionsModule.register({ isGlobal: true, ...options.webhookConnections }),
    GoogleConnectionsModule.register({ isGlobal: true }),
    MetaConnectionsModule.register({ isGlobal: true }),
    MetaInboxModule.register({ isGlobal: true }),
    ConnectionLifecycleModule.register({ isGlobal: true }),
    ConnectionCommandsModule.register({ isGlobal: true }),
    GoogleModule.register({ isGlobal: true, ...options.google }),
    MetaModule.register({ isGlobal: true, ...options.meta }),
    ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
    WebhookDeliveryModule.register({ isGlobal: true, ...options.webhookDelivery }),
    // The providers of the generic purposes (domains, speech, dubbing, video, books): each integration's client and the provider module
    // that registers its ports in the provider registry; core code asks the purpose, never the provider.
    InetModule.register({ isGlobal: true, ...options.inet }),
    TinoModule.register({ isGlobal: true, ...options.tino }),
    PayosModule.register({ isGlobal: true, ...options.payos }),
    ElevenLabsModule.register({ isGlobal: true, ...options.elevenlabs }),
    VeoModule.register({ isGlobal: true, ...options.veo }),
    GoogleCalendarModule.register({ isGlobal: true, ...options.googleCalendar }),
    MetaPublishingModule.register({ isGlobal: true, ...options.metaPublishing }),
    YoutubeModule.register({ isGlobal: true, ...options.youtube }),
    TiktokModule.register({ isGlobal: true, ...options.tiktok }),
    MisaAmisModule.register({ isGlobal: true, ...options.misaAmis }),
    MisaMeinvoiceModule.register({ isGlobal: true, ...options.misaMeinvoice }),
    // Cloud video compose (no heavy tool in NIVO): the generic purpose and its render door's intake first (the compose providers register
    // their ports in its registry), then each compose service's client.
    VideoComposeModule.register({ isGlobal: true }),
    ShotstackModule.register({ isGlobal: true, ...options.shotstack }),
    CreatomateModule.register({ isGlobal: true, ...options.creatomate }),
    Json2VideoModule.register({ isGlobal: true, ...options.json2video }),
    InetProviderModule.register({ isGlobal: true }),
    TinoProviderModule.register({ isGlobal: true }),
    PayosProviderModule.register({ isGlobal: true }),
    ElevenLabsProviderModule.register({ isGlobal: true }),
    VeoProviderModule.register({ isGlobal: true }),
    GoogleCalendarProviderModule.register({ isGlobal: true }),
    MetaPublishingProviderModule.register({ isGlobal: true }),
    // PUBLISH_FILE_SOURCE stays unbound: the file store has no reader of a stored file by id yet, so a YouTube upload of a stored file
    // answers not_available (nothing sent) until one exists.
    YoutubeProviderModule.register({ isGlobal: true }),
    TiktokProviderModule.register({ isGlobal: true }),
    MisaAmisProviderModule.register({ isGlobal: true }),
    MisaMeinvoiceProviderModule.register({ isGlobal: true }),
    ShotstackProviderModule.register({ isGlobal: true }),
    CreatomateProviderModule.register({ isGlobal: true }),
    Json2VideoProviderModule.register({ isGlobal: true }),
    // The generic connection form: each writer is the provider's own, provided by its global capability module.
    ConnectionFieldsModule.register({
        isGlobal: true,
        writers: CONNECTION_FIELD_WRITER_CLASSES,
    }),
    ConnectionFieldsGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const connectionsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    CONNECTIONS_ERROR_KINDS,
    ACCOUNT_DATA_ERROR_KINDS,
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
    CONNECTION_FIELDS_ERROR_KINDS,
    INET_ERROR_KINDS,
    TINO_ERROR_KINDS,
    PAYOS_ERROR_KINDS,
    ELEVENLABS_ERROR_KINDS,
    VEO_ERROR_KINDS,
    GOOGLE_CALENDAR_ERROR_KINDS,
    META_PUBLISHING_ERROR_KINDS,
    YOUTUBE_ERROR_KINDS,
    TIKTOK_ERROR_KINDS,
    MISA_AMIS_ERROR_KINDS,
    MISA_MEINVOICE_ERROR_KINDS,
    SHOTSTACK_ERROR_KINDS,
    CREATOMATE_ERROR_KINDS,
    JSON2VIDEO_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const connectionsMessages: ReadonlyArray<MessageBundle> = [
    DOCUMENTS_MESSAGES,
    CONNECTIONS_MESSAGES,
    ACCOUNT_DATA_MESSAGES,
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
    CONNECTION_FIELDS_MESSAGES,
    INET_MESSAGES,
    TINO_MESSAGES,
    PAYOS_MESSAGES,
    ELEVENLABS_MESSAGES,
    VEO_MESSAGES,
    GOOGLE_CALENDAR_MESSAGES,
    META_PUBLISHING_MESSAGES,
    YOUTUBE_MESSAGES,
    TIKTOK_MESSAGES,
    MISA_AMIS_MESSAGES,
    MISA_MEINVOICE_MESSAGES,
    SHOTSTACK_MESSAGES,
    CREATOMATE_MESSAGES,
    JSON2VIDEO_MESSAGES,
]

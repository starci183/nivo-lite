import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { I18nModule } from "@modules/platform/i18n"
import { JobsModule } from "@modules/platform/jobs"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { refused } from "@modules/platform/primitives"
import { ZaloModule } from "@modules/integrations/zalo"
import { MetaModule } from "@modules/integrations/meta"
import { ConnectionsModule } from "@modules/domain/connections"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConversationsService, CONVERSATIONS_MESSAGES } from "@modules/domain/conversations"
import { CustomerHearingService } from "../../modules/domain/conversations/customer-hearing.service"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { CHANNELS_OPTIONS } from "../../modules/domain/channels/channels.decorators"
import { ChatRecordsModule } from "@modules/domain/chat-records"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_JOBS } from "@nivo-lite/blocks-core/modules"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AGENTS_INSTALLATIONS, AgentDirectoryService, AgentsModule } from "@modules/domain/agents"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { EventsModule } from "@modules/domain/events"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { PaymentOrdersModule } from "@modules/domain/payment-orders"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { ConnectionPollModule } from "@modules/domain/connection-poll"
import { ProviderRegistryModule } from "@modules/domain/provider-registry"
import { BillingModule, BILLING_MESSAGES } from "@modules/domain/billing"
import { PaymentTransactionsModule } from "@modules/domain/payment-transactions"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { TransactionsModule } from "@modules/domain/transactions"
import { BankFeedInboxModule } from "@modules/domain/bank-feed-inbox"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { MetaInboxModule } from "@modules/domain/meta-inbox"
import { QUIET_AGENT_TAGS, QUIET_CUSTOMER_INTAKE, QUIET_INSTALLATIONS } from "./quiet-peers.options"
import { AgentTagService } from "../../modules/domain/agent-work/agent-tag.service"
import { DEFAULT_POLL_SCHEDULE } from "../../modules/domain/connection-poll/poll-schedule.policy"
import { worldIds } from "./lite-world.service"
import { QUEUE_MODULES } from "./test-capabilities.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** Receipt proofs stop before downstream Meta event jobs are consumed. */
class DeferredMetaEvents {
    take(): Promise<boolean> {
        return Promise.resolve().then(() => {
            throw new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
        })
    }
}

/** The members proof needs an account directory but reads no account. */
class ProofAccounts {
    accountOf() {
        return Promise.resolve(refused("IDENTITY_ACCOUNT_NOT_FOUND"))
    }
}

@Module({})
class DeliveryPeersModule {
    static register(): DynamicModule {
        return {
            module: DeliveryPeersModule,
            global: true,
            providers: [
                ConversationsService,
                CustomerHearingService,
                DeferredMetaEvents,
                ProofAccounts,
                QUIET_AGENT_TAGS,
                QUIET_CUSTOMER_INTAKE,
                QUIET_INSTALLATIONS,
                { provide: CHANNELS_OPTIONS, useFactory: () => ({ siteUrl: "http://localhost" }) },
                ZaloCredentialsService,
            ],
            exports: [ConversationsService, DeferredMetaEvents, ProofAccounts, AgentTagService, AGENTS_INSTALLATIONS],
        }
    }
}

const platformModules = (tokenKey: Secret): Array<DynamicModule> => [
    ...QUEUE_MODULES,
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "delivery-proof",
        leaseMs: 100,
        scheduler: { enabled: false },
    }),
    I18nModule.register({ isGlobal: true, bundles: [CONVERSATIONS_MESSAGES, BILLING_MESSAGES] }),
    HttpSecurityModule.register({
        isGlobal: true,
        trustedProxyHops: 0,
        allowedOrigins: [],
        rateLimit: { windowMs: 1000, defaultLimit: 100, strictLimit: 100 },
        webhooks: {},
    }),
    ZaloModule.register({
        isGlobal: true,
        oauthBase: "http://localhost",
        apiBase: "http://localhost",
        businessBase: "http://localhost",
        timeoutMs: 1000,
    }),
    MetaModule.register({
        isGlobal: true,
        app: { appId: "delivery-proof", appSecret: new Secret("delivery-proof-meta") },
        webhookVerifyToken: undefined,
        loginConfigId: undefined,
        graphVersion: "v21.0",
        siteUrl: undefined,
        channelTokenKey: tokenKey,
        sendPerMinute: 60,
        timeoutMs: 1000,
    }),
]

const domainModules = (tokenKey: Secret): Array<DynamicModule> => [
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: tokenKey,
        siteUrl: "http://localhost",
        publicSiteUrl: undefined,
    }),
    EntityEngineModule.register({
        isGlobal: true,
        alerts: ReadOnlyEngineAlertsService,
        entities: FLOW_F_ENTITIES,
        jobs: MODULE_JOBS,
        cursorKey: tokenKey,
    }),
    ChatRecordsModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    InboundEventsModule.register({ isGlobal: true }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: ProofAccounts }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: false }),
    PaymentOrdersModule.register({ isGlobal: true }),
    BankFeedInboxModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    ChannelSetupModule.register({ isGlobal: true, zaloOauthBase: undefined, siteUrl: undefined, timeoutMs: 1000 }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    ProviderRegistryModule.register({ isGlobal: true }),
    ConnectionPollModule.register({ isGlobal: true, schedule: DEFAULT_POLL_SCHEDULE, redis: undefined }),
    BillingModule.register({
        isGlobal: true,
        sepayApiKey: new Secret("delivery-proof-key"),
        bankAccount: { account: "", bank: "", holder: "" },
    }),
    PaymentTransactionsModule.register({ isGlobal: true }),
    SepayTransactionsModule.register({ isGlobal: true }),
    DeliveryPeersModule.register(),
    TelegramInboxModule.register({ isGlobal: true }),
    MetaInboxModule.register({ isGlobal: true, taker: DeferredMetaEvents }),
]

type DeliveryCapabilitiesResultShape = {
    workspaceId: string
    modules: Array<DynamicModule>
}

/** Real receipt owners, database claims and outbox; consumers remain idle until a proof invokes them. */
export const deliveryCapabilities = (): DeliveryCapabilitiesResultShape => {
    const workspaceId = worldIds.next()
    const tokenKey = new Secret(Buffer.alloc(32, 7).toString("base64"))
    return { workspaceId, modules: [...platformModules(tokenKey), ...domainModules(tokenKey)] }
}

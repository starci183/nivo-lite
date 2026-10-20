import { randomUUID } from "node:crypto"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { I18nModule } from "@modules/platform/i18n"
import { JobsModule } from "@modules/platform/jobs"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { SupabaseModule, SUPABASE_AUTH } from "@modules/integrations/supabase"
import { ZaloModule, ZALO } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { MetaModule } from "@modules/integrations/meta"
import { ConnectionsModule, ConnectionsService } from "@modules/domain/connections"
import { ConnectionSecretsModule, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConversationsService, CONVERSATIONS_MESSAGES } from "@modules/domain/conversations"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { AgentMessagesModule } from "@modules/domain/agent-messages"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { EventsModule } from "@modules/domain/events"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { PaymentOrdersModule } from "@modules/domain/payment-orders"
import { BillingModule, BILLING_MESSAGES } from "@modules/domain/billing"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { VietcombankInboxModule } from "@modules/domain/vietcombank-inbox"
import { BankFeedInboxModule } from "@modules/domain/bank-feed-inbox"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { MetaInboxModule } from "@modules/domain/meta-inbox"
import { ChatTurnModule } from "@modules/queues/chat-turn"
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

@Module({})
class DeliveryPeersModule {
    static register(): DynamicModule {
        return {
            module: DeliveryPeersModule,
            global: true,
            imports: [ChatTurnModule.register({})],
            providers: [
                ConversationsService,
                DeferredMetaEvents,
                {
                    provide: ZaloCredentialsService,
                    useFactory: (
                        clock: Clock,
                        zalo: ZaloClient,
                        logger: Logger,
                        secrets: ConnectionSecretsService,
                        connections: ConnectionsService,
                    ) =>
                        new ZaloCredentialsService(
                            clock,
                            { siteUrl: "http://localhost" },
                            zalo,
                            logger,
                            secrets,
                            connections,
                        ),
                    inject: [CLOCK, ZALO, LOGGER, ConnectionSecretsService, ConnectionsService],
                },
            ],
            exports: [ConversationsService, DeferredMetaEvents],
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
    }),
    I18nModule.register({ isGlobal: true, bundles: [CONVERSATIONS_MESSAGES, BILLING_MESSAGES] }),
    HttpSecurityModule.register({
        isGlobal: true,
        trustedProxyHops: 0,
        allowedOrigins: [],
        rateLimit: { windowMs: 1000, defaultLimit: 100, strictLimit: 100 },
        webhooks: {},
    }),
    SupabaseModule.register({
        isGlobal: true,
        url: "http://localhost:54321",
        serviceRoleKey: new Secret("proof-key"),
    }),
    ZaloModule.register({
        isGlobal: true,
        oauthBase: "http://localhost",
        apiBase: "http://localhost",
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

const domainModules = (tokenKey: Secret, workspaceId: string): Array<DynamicModule> => [
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: tokenKey,
        siteUrl: "http://localhost",
        publicSiteUrl: undefined,
    }),
    AgentConversationsModule.register({ isGlobal: true }),
    AgentMessagesModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
    PaymentOrdersModule.register({ isGlobal: true }),
    VietcombankInboxModule.register({ isGlobal: true }),
    BankFeedInboxModule.register({ isGlobal: true }),
    BillingModule.register({
        isGlobal: true,
        sepayApiKey: new Secret("delivery-proof-key"),
        bankAccount: { account: "", bank: "", holder: "" },
        simulatedBank: { secret: new Secret("delivery-proof-bank-fixture"), workspaceId },
        channelTokenKey: tokenKey,
    }),
    SepayTransactionsModule.register({ isGlobal: true }),
    DeliveryPeersModule.register(),
    TelegramInboxModule.register({ isGlobal: true }),
    MetaInboxModule.register({ isGlobal: true, taker: DeferredMetaEvents }),
]

/** Real receipt owners, database claims and outbox; consumers remain idle until a proof invokes them. */
export const deliveryCapabilities = () => {
    const workspaceId = randomUUID()
    const tokenKey = new Secret(Buffer.alloc(32, 7).toString("base64"))
    return { workspaceId, modules: [...platformModules(tokenKey), ...domainModules(tokenKey, workspaceId)] }
}

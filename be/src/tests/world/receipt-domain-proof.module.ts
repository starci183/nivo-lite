import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatRecordsModule } from "@modules/domain/chat-records"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AGENTS_INSTALLATIONS, AgentDirectoryService, AgentsModule } from "@modules/domain/agents"
import { ZaloCredentialsService, ZaloWebhookGateService } from "@modules/domain/channels"
import { CHANNELS_OPTIONS } from "../../modules/domain/channels/channels.decorators"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_JOBS } from "@nivo-lite/blocks-core/modules"
import { CustomerHearingService } from "../../modules/domain/conversations/customer-hearing.service"
import { EventsModule } from "@modules/domain/events"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ProviderRegistryModule } from "@modules/domain/provider-registry"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { PaymentProofService } from "@modules/domain/billing"
import { PaymentSecretsService } from "../../modules/domain/billing/payment-secrets.service"
import { BILLING_OPTIONS } from "../../modules/domain/billing/billing.decorators"
import type { BillingOptions } from "../../modules/domain/billing/billing.options"
import { ZaloModule } from "@modules/integrations/zalo"
import { Secret } from "@modules/platform/config"
import { I18nModule } from "@modules/platform/i18n"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { QUIET_CUSTOMER_INTAKE, QUIET_INSTALLATIONS } from "./quiet-peers.options"
import { ZaloDeliveryQueue } from "../../modules/queues/zalo-delivery/zalo-delivery.queue"

const tokenKey = new Secret(Buffer.alloc(32, 7).toString("base64"))
const siteUrl = "http://localhost:3000"
const billingOptions = (): BillingOptions => ({
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
})

@Module({
    providers: [
        { provide: CHANNELS_OPTIONS, useFactory: () => ({ siteUrl }) },
        { provide: BILLING_OPTIONS, useFactory: billingOptions },
        { provide: INBOX, useClass: InboxService },
        ZaloDeliveryQueue,
        ZaloCredentialsService,
        ZaloWebhookGateService,
        ConversationsService,
        CustomerHearingService,
        QUIET_CUSTOMER_INTAKE,
        QUIET_INSTALLATIONS,
        InboundEventsService,
        PaymentSecretsService,
        PaymentProofService,
        PaymentOrdersService,
        SepayTransactionsService,
    ],
    exports: [
        ConversationsService,
        AGENTS_INSTALLATIONS,
        InboundEventsService,
        SepayTransactionsService,
        ZaloDeliveryQueue,
        ZaloWebhookGateService,
    ],
})
/** Composes real receipt consumers and their dependencies; these proofs make no provider network calls. */
export class ReceiptDomainProofModule {
    /** Makes the domain owners visible to the delivery feature modules in this suite. */
    static register(): DynamicModule {
        return { module: ReceiptDomainProofModule, global: true }
    }
}

/** Registers each real capability once at the test-world composition root. */
export const RECEIPT_DOMAIN_MODULES: ReadonlyArray<DynamicModule> = [
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey }),
    ConnectionsModule.register({ isGlobal: true, channelTokenKey: tokenKey, siteUrl, publicSiteUrl: undefined }),
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
    I18nModule.register({ isGlobal: true, bundles: [] }),
    ZaloModule.register({
        isGlobal: true,
        oauthBase: "http://127.0.0.1:1",
        apiBase: "http://127.0.0.1:1",
        businessBase: "http://127.0.0.1:1",
        timeoutMs: 100,
    }),
    ProviderRegistryModule.register({ isGlobal: true }),
    ZaloInboxModule.register({ isGlobal: true }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    ReceiptDomainProofModule.register(),
]

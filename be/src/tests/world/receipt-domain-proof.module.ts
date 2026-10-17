import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { AgentMessagesModule } from "@modules/domain/agent-messages"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { CHANNELS_OPTIONS } from "../../modules/domain/channels/channels.decorators"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { ConversationsService } from "@modules/domain/conversations"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { PaymentProofService } from "@modules/domain/billing"
import { PaymentSecretsService } from "../../modules/domain/billing/payment-secrets.service"
import { BILLING_OPTIONS } from "../../modules/domain/billing/billing.decorators"
import type { BillingOptions } from "../../modules/domain/billing/billing.options"
import { ZaloModule } from "@modules/integrations/zalo"
import { Secret } from "@modules/platform/config"
import { I18nModule } from "@modules/platform/i18n"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { ZaloDeliveryQueue } from "../../modules/queues/zalo-delivery/zalo-delivery.queue"

const tokenKey = new Secret(Buffer.alloc(32, 7).toString("base64"))
const siteUrl = "http://localhost:3000"
const billingOptions = (): BillingOptions => ({
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: undefined, workspaceId: undefined },
    channelTokenKey: tokenKey,
})

@Module({
    providers: [
        { provide: CHANNELS_OPTIONS, useFactory: () => ({ siteUrl }) },
        { provide: BILLING_OPTIONS, useFactory: billingOptions },
        { provide: INBOX, useClass: InboxService },
        ChatTurnQueue,
        ZaloDeliveryQueue,
        ZaloCredentialsService,
        ConversationsService,
        InboundEventsService,
        PaymentSecretsService,
        PaymentProofService,
        SepayTransactionsService,
    ],
    exports: [ConversationsService, SepayTransactionsService, ZaloDeliveryQueue],
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
    AgentConversationsModule.register({ isGlobal: true }),
    AgentMessagesModule.register({ isGlobal: true }),
    I18nModule.register({ isGlobal: true, bundles: [] }),
    ZaloModule.register({
        isGlobal: true,
        oauthBase: "http://127.0.0.1:1",
        apiBase: "http://127.0.0.1:1",
        timeoutMs: 100,
    }),
    ZaloInboxModule.register({ isGlobal: true }),
    ReceiptDomainProofModule.register(),
]

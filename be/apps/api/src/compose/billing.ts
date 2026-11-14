import { BankFeedInboxModule } from "@modules/domain/bank-feed-inbox"
import type { DynamicModule } from "@nestjs/common"
import { CassoHttpModule } from "@features/webhooks/casso"
import { PayosHttpModule } from "@features/webhooks/payos"
import { SepayHttpModule } from "@features/webhooks/sepay"
import { SepayFeedHttpModule } from "@features/webhooks/sepay-feed"
import {
    PAYMENT_ORDER_REQUESTS_ERROR_KINDS,
    PAYMENT_ORDER_REQUESTS_MESSAGES,
    PaymentOrderRequestsModule,
} from "@modules/domain/payment-order-requests"
import { BILLING_ERROR_KINDS, BILLING_MESSAGES, BillingModule } from "@modules/domain/billing"
import {
    PAYMENT_ORDERS_ERROR_KINDS,
    PAYMENT_ORDERS_MESSAGES,
    PaymentOrdersModule,
} from "@modules/domain/payment-orders"
import { CREDITS_ERROR_KINDS, CREDITS_MESSAGES, CreditsModule } from "@modules/domain/credits"
import { AiUsageEventsModule } from "@modules/domain/ai-usage-events"
import {
    CONNECTION_POLL_ERROR_KINDS,
    CONNECTION_POLL_MESSAGES,
    ConnectionPollModule,
} from "@modules/domain/connection-poll"
import {
    PROVIDER_REGISTRY_ERROR_KINDS,
    PROVIDER_REGISTRY_MESSAGES,
    ProviderRegistryModule,
} from "@modules/domain/provider-registry"
import { RedisModule } from "@modules/integrations/redis"
import { PROVIDER_SANDBOX_ERROR_KINDS, PROVIDER_SANDBOX_MESSAGES, ProviderSandboxModule } from "@modules/domain/provider-sandbox"
import { CassoProviderModule } from "@modules/domain/casso-provider"
import { SepayProviderModule } from "@modules/domain/sepay-provider"
import { AgentDirectoryService } from "@modules/domain/agents"
import { TeamChatNoticesService } from "@modules/domain/team-chat"
import { ProviderTriggersModule } from "@modules/domain/provider-triggers"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { BillingGraphqlModule } from "@features/api/billing"
import { CreditsGraphqlModule } from "@features/api/credits"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The billing area of the API, in registration order. */
export const billingModules = (options: ApiOptions): Array<DynamicModule> => [
    PaymentOrdersModule.register({ isGlobal: true }),
    ProviderRegistryModule.register({ isGlobal: true }),
    ProviderSandboxModule.register({ isGlobal: true, sandbox: options.providerSandbox, loopbackPort: options.server.port }),
    RedisModule.register({ isGlobal: true, ...options.redis }),
    ConnectionPollModule.register({ isGlobal: true, ...options.connectionPoll }),
    BankFeedInboxModule.register({ isGlobal: true }),
    SepayProviderModule.register({ isGlobal: true, feedWebhook: true }),
    CassoProviderModule.register({ isGlobal: true }),
    BillingModule.register({ isGlobal: true, ...options.billing }),
    ProviderTriggersModule.register({ isGlobal: true, ports: { agentNames: AgentDirectoryService } }),
    BillingGraphqlModule.register({}),
    SepayTransactionsModule.register({ isGlobal: true }),
    AiUsageEventsModule.register({ isGlobal: true, notices: TeamChatNoticesService }),
    CreditsModule.register({ isGlobal: true }),
    CreditsGraphqlModule.register({}),
    PaymentOrderRequestsModule.register({ isGlobal: true }),
    CassoHttpModule.register({}),
    PayosHttpModule.register({}),
    SepayHttpModule.register({}),
    SepayFeedHttpModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const billingErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    BILLING_ERROR_KINDS,
    PAYMENT_ORDER_REQUESTS_ERROR_KINDS,
    CREDITS_ERROR_KINDS,
    PAYMENT_ORDERS_ERROR_KINDS,
    CONNECTION_POLL_ERROR_KINDS,
    PROVIDER_REGISTRY_ERROR_KINDS,
    PROVIDER_SANDBOX_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const billingMessages: ReadonlyArray<MessageBundle> = [
    BILLING_MESSAGES,
    PAYMENT_ORDER_REQUESTS_MESSAGES,
    CREDITS_MESSAGES,
    PAYMENT_ORDERS_MESSAGES,
    CONNECTION_POLL_MESSAGES,
    PROVIDER_REGISTRY_MESSAGES,
    PROVIDER_SANDBOX_MESSAGES,
]

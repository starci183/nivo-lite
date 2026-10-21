import { BankFeedInboxModule } from "@modules/domain/bank-feed-inbox"
import type { DynamicModule } from "@nestjs/common"
import { CassoHttpModule } from "@features/webhooks/casso"
import { PayosHttpModule } from "@features/webhooks/payos"
import { SepayHttpModule } from "@features/webhooks/sepay"
import { SepayFeedHttpModule } from "@features/webhooks/sepay-feed"
import { PaymentOrderRequestsModule } from "@modules/domain/payment-order-requests"
import { BillingModule } from "@modules/domain/billing"
import { PaymentOrdersModule } from "@modules/domain/payment-orders"
import { CreditsModule } from "@modules/domain/credits"
import { AiUsageEventsModule } from "@modules/domain/ai-usage-events"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { BillingGraphqlModule } from "@features/api/billing"
import { CreditsGraphqlModule } from "@features/api/credits"
import type { ApiOptions } from "../api.options"
/** The billing area of the API, in registration order. */
export const billingModules = (options: ApiOptions): Array<DynamicModule> => [
    PaymentOrdersModule.register({ isGlobal: true }),
    BankFeedInboxModule.register({ isGlobal: true }),
    BillingModule.register({ isGlobal: true, ...options.billing }),
    BillingGraphqlModule.register({}),
    SepayTransactionsModule.register({ isGlobal: true }),
    AiUsageEventsModule.register({ isGlobal: true }),
    CreditsModule.register({ isGlobal: true }),
    CreditsGraphqlModule.register({}),
    PaymentOrderRequestsModule.register({ isGlobal: true }),
    CassoHttpModule.register({}),
    PayosHttpModule.register({}),
    SepayHttpModule.register({}),
    SepayFeedHttpModule.register({}),
]

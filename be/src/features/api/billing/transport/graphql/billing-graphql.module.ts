import { Module } from "@nestjs/common"
import { BillingBankAccountResolver } from "./billing-bank-account.resolver"
import { BillingApiModule } from "../../billing.module"
import { ConfigurableModuleClass } from "./billing-graphql.module-definition"
import { BillingPlansResolver } from "./billing-plans.resolver"
import { BillingPlanQuoteResolver } from "./billing-plan-quote.resolver"
import { BillingStorageResolver } from "./billing-storage.resolver"
import { BillingPlanResolver } from "./billing-plan.resolver"
import { BillingWorkspacesResolver } from "./billing-workspaces.resolver"
import { BillingWorkspaceResolver } from "./billing-workspace.resolver"
import { PaymentOrdersResolver } from "./payment-orders.resolver"
import { PaymentOrderResolver } from "./payment-order.resolver"
import { OpenPlanPaymentOrderResolver } from "./open-plan-payment-order.resolver"
import { BillingReviewTransactionsResolver } from "./billing-review-transactions.resolver"
import { RequestPaymentOrderResolver } from "./request-payment-order.resolver"
import { PaymentOrderRequestStatusResolver } from "./payment-order-request-status.resolver"

@Module({
    imports: [BillingApiModule.register({})],
    providers: [
        BillingBankAccountResolver,
        BillingPlansResolver,
        BillingPlanQuoteResolver,
        BillingStorageResolver,
        BillingPlanResolver,
        BillingWorkspacesResolver,
        BillingWorkspaceResolver,
        PaymentOrdersResolver,
        PaymentOrderResolver,
        OpenPlanPaymentOrderResolver,
        BillingReviewTransactionsResolver,
        RequestPaymentOrderResolver,
        PaymentOrderRequestStatusResolver,
    ],
})
/** Authenticated GraphQL billing transport. */
export class BillingGraphqlModule extends ConfigurableModuleClass {}

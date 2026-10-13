import { Module } from "@nestjs/common"
import { BillingBankAccountHandler } from "./application/billing-bank-account.handler"
import { BillingPlansHandler } from "./application/billing-plans.handler"
import { BillingPlanHandler } from "./application/billing-plan.handler"
import { BillingWorkspacesHandler } from "./application/billing-workspaces.handler"
import { BillingWorkspaceHandler } from "./application/billing-workspace.handler"
import { PaymentOrdersHandler } from "./application/payment-orders.handler"
import { PaymentOrderHandler } from "./application/payment-order.handler"
import { OpenPlanPaymentOrderHandler } from "./application/open-plan-payment-order.handler"
import { BillingReviewTransactionsHandler } from "./application/billing-review-transactions.handler"
import { RequestPaymentOrderHandler } from "./application/request-payment-order.handler"
import { PaymentOrderRequestStatusHandler } from "./application/payment-order-request-status.handler"

@Module({
    providers: [
        BillingBankAccountHandler,
        BillingPlansHandler,
        BillingPlanHandler,
        BillingWorkspacesHandler,
        BillingWorkspaceHandler,
        PaymentOrdersHandler,
        PaymentOrderHandler,
        OpenPlanPaymentOrderHandler,
        BillingReviewTransactionsHandler,
        RequestPaymentOrderHandler,
        PaymentOrderRequestStatusHandler,
    ],
})
/** Application handlers for billing reads and queued payment requests. */
export class BillingApiModule {}

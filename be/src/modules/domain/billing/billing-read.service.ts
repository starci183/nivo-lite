import { Injectable } from "@nestjs/common"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { BillingService } from "./billing.service"
import type { BillingPaymentOrder, BillingPaymentOrderLookup } from "./billing.contracts"
import { paymentInstructionsOf } from "./billing-payment-order.mapper"

@Injectable()
/** Authorized billing payment reads with backend payment instructions. */
export class BillingReadService {
    constructor(
        private readonly billing: BillingService,
        private readonly orders: PaymentOrdersService,
    ) {}

    /** Latest orders of an active member's selected workspace. */
    async paymentOrders(userId: string, workspaceId: string): Promise<ReadonlyArray<BillingPaymentOrder>> {
        await this.billing.requireMember(userId, workspaceId)
        const orders = await this.orders.list(workspaceId)
        return orders.map((order) => paymentInstructionsOf(this.billing.payable(order)))
    }

    /** A member's scoped order, including expiry-normalized status. */
    async paymentOrder(userId: string, workspaceId: string, id: string): Promise<BillingPaymentOrderLookup> {
        await this.billing.requireMember(userId, workspaceId)
        const order = await this.orders.find(workspaceId, id)
        return order === null ? null : paymentInstructionsOf(this.billing.payable(order))
    }

    /** Latest unexpired plan order of a member's selected workspace. */
    async openPlanPaymentOrder(userId: string, workspaceId: string): Promise<BillingPaymentOrderLookup> {
        await this.billing.requireMember(userId, workspaceId)
        const order = await this.orders.findOpenPlan(workspaceId)
        return order === null ? null : paymentInstructionsOf(this.billing.payable(order))
    }
}

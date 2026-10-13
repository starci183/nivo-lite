import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { OrdersError, OrdersErrorCode } from "./errors/orders.error"
import type { NewOrderDraft, OptionalOrder, OrderConfirmation, OrderLabel } from "./orders.contracts"
import { ORDER_NUMBER_ATTEMPTS, orderNumberOf, orderPrefixOf } from "./order-number.policy"
import type { OrderCountRow, SalesOrderListRow, SalesOrderRow } from "./persistence/orders.rows"
import {
    CANCEL_ORDER,
    CONFIRM_ORDER,
    COUNT_ORDERS_WITH_PREFIX,
    FIND_ORDER,
    FIND_ORDER_LABELS,
    INSERT_ORDER_DRAFT,
    LIST_ORDERS,
    SET_ORDER_STATUS,
} from "./persistence/orders.sql"

@Injectable()
/** The orders of a workspace: the only writer of public.orders. */
export class OrdersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The order of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, orderId: string): Promise<OptionalOrder> {
        const rows = await this.entityManager.query<Array<SalesOrderRow>>(FIND_ORDER, [workspaceId, orderId])
        return rows[0] ?? null
    }

    /** The newest orders with customer labels for the workspace's workbenches. */
    list(workspaceId: string, limit: number = 200): Promise<Array<SalesOrderListRow>> {
        return this.entityManager.query<Array<SalesOrderListRow>>(LIST_ORDERS, [
            workspaceId,
            Math.min(500, Math.max(1, limit)),
        ])
    }

    /** The number and items of the given orders. */
    labelsOf(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<OrderLabel>> {
        if (orderIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<OrderLabel>>(FIND_ORDER_LABELS, [workspaceId, orderIds])
    }

    /** Writes a draft order under a free number; a number the channel gave that is taken gets a suffix. */
    async draft(input: NewOrderDraft): Promise<SalesOrderRow> {
        const prefix = orderPrefixOf(this.clock.now())
        const taken = input.orderNo === null ? await this.takenToday(input.workspaceId, prefix) : 0
        return this.insertDraft(input, prefix, taken, 0)
    }

    /** Confirms a draft; answers null when the order is no longer a draft, so a repeated confirmation changes nothing. */
    async confirm(confirmation: OrderConfirmation): Promise<OptionalOrder> {
        const rows = await this.entityManager.query<Array<SalesOrderRow>>(CONFIRM_ORDER, [
            confirmation.workspaceId,
            confirmation.orderId,
            confirmation.amountVnd,
            confirmation.items,
            confirmation.confirmedBy,
            this.clock.now().toISOString(),
        ])
        return rows[0] ?? null
    }

    /** Cancels a draft and answers it; null when the order is no longer a draft. */
    async cancel(workspaceId: string, orderId: string): Promise<OptionalOrder> {
        const rows = await this.entityManager.query<Array<SalesOrderRow>>(CANCEL_ORDER, [workspaceId, orderId])
        return rows[0] ?? null
    }

    /** The order has an invoice. */
    async markInvoiced(workspaceId: string, orderId: string): Promise<void> {
        await this.entityManager.query(SET_ORDER_STATUS, [workspaceId, orderId, "invoiced"])
    }

    /** The order is paid. */
    async markPaid(workspaceId: string, orderId: string): Promise<void> {
        await this.entityManager.query(SET_ORDER_STATUS, [workspaceId, orderId, "paid"])
    }

    private async takenToday(workspaceId: string, prefix: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<OrderCountRow>>(COUNT_ORDERS_WITH_PREFIX, [
            workspaceId,
            prefix,
        ])
        return row?.n ?? 0
    }

    private async insertDraft(
        input: NewOrderDraft,
        prefix: string,
        taken: number,
        attempt: number,
    ): Promise<SalesOrderRow> {
        if (attempt >= ORDER_NUMBER_ATTEMPTS) throw new OrdersError({ code: OrdersErrorCode.NotNumbered })
        const rows = await this.entityManager.query<Array<SalesOrderRow>>(INSERT_ORDER_DRAFT, [
            input.workspaceId,
            input.leadId,
            input.inboundEventId,
            orderNumberOf(input.orderNo, prefix, taken, attempt),
            input.items,
            input.amountVnd,
            input.origin,
        ])
        return rows[0] ?? this.insertDraft(input, prefix, taken, attempt + 1)
    }
}

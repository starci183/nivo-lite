import { Injectable } from "@nestjs/common"
import { In, IsNull, Like, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { LeadReadService } from "@modules/domain/leads"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readConnection } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { OrdersError, OrdersErrorCode } from "./errors/orders.error"
import type {
    NewOrderDraft,
    OptionalOrder,
    OrderConfirmation,
    OrderLabel,
    OrderRef,
    OptionalOrdersWorkbench,
    OrdersWorkbenchRow,
    SalesOrderListRow,
    SalesOrderRow,
} from "./orders.contracts"
import { ORDER_NUMBER_ATTEMPTS, orderNumberOf, orderPrefixOf } from "./order-number.policy"
import { OrderEntity } from "./persistence/entities"

/** The most orders a list reads at once. */
const LIST_MAX = 500

/** How many orders of one customer a journey shows. */
const LEAD_ORDERS_LIMIT = 500

/** How many order labels are read at once. */
const LABELS_LIMIT = 200

/** The statuses from which an order may ship. */
const SHIPPABLE = ["confirmed", "invoiced", "paid"] as const

const isoOf = (value: Date | null): string | null => (value === null ? null : value.toISOString())

/** Maps a stored order to the order contract (snake case, ISO 8601 instants, a number for the money). */
const toOrderRow = (order: OrderEntity): SalesOrderRow => ({
    id: order.id,
    workspace_id: order.workspaceId,
    lead_id: order.leadId,
    inbound_event_id: order.inboundEventId,
    order_no: order.orderNo,
    items: order.items,
    amount_vnd: order.amountVnd,
    status: order.status,
    confirmed_by: order.confirmedBy,
    confirmed_at: isoOf(order.confirmedAt),
    created_at: order.createdAt.toISOString(),
    shipped_at: isoOf(order.shippedAt),
    carrier: order.carrier,
    tracking_code: order.trackingCode,
})

/** The columns a write answers with `RETURNING *`, bigint and instants as the driver gives them. */
interface WrittenOrder {
    readonly id: string
    readonly workspace_id: string
    readonly lead_id: string | null
    readonly inbound_event_id: string | null
    readonly order_no: string
    readonly items: string
    readonly amount_vnd: string | number | null
    readonly status: string
    readonly confirmed_by: string | null
    readonly confirmed_at: Date | null
    readonly created_at: Date
    readonly shipped_at: Date | null
    readonly carrier: string | null
    readonly tracking_code: string | null
}

/** Maps the answer of a write to the order contract. */
const fromWritten = (row: WrittenOrder): SalesOrderRow => ({
    id: row.id,
    workspace_id: row.workspace_id,
    lead_id: row.lead_id,
    inbound_event_id: row.inbound_event_id,
    order_no: row.order_no,
    items: row.items,
    amount_vnd: row.amount_vnd === null ? null : Number(row.amount_vnd),
    status: row.status,
    confirmed_by: row.confirmed_by,
    confirmed_at: isoOf(row.confirmed_at),
    created_at: row.created_at.toISOString(),
    shipped_at: isoOf(row.shipped_at),
    carrier: row.carrier,
    tracking_code: row.tracking_code,
})

/** The keyset page columns: instants stay the database's own text, so a cursor keeps every microsecond. */
interface PagedOrder extends Omit<SalesOrderRow, "created_at" | "confirmed_at" | "shipped_at" | "amount_vnd"> {
    readonly created_at: string
    readonly confirmed_at: string | null
    readonly shipped_at: string | null
    readonly amount_vnd: number | null
}

@Injectable()
/** The orders of a workspace: the only writer of public.orders. */
export class OrdersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly leads: LeadReadService,
    ) {}

    /** The order of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, orderId: string): Promise<OptionalOrder> {
        const order = await this.entityManager.findOne(OrderEntity, { where: { workspaceId, id: orderId } })
        return order === null ? null : toOrderRow(order)
    }

    /** Whether the workspace has an order with this id. */
    exists(workspaceId: string, orderId: string): Promise<boolean> {
        return this.entityManager.exists(OrderEntity, { where: { workspaceId, id: orderId } })
    }

    /** The newest orders with customer labels for the workspace's workbenches. */
    async list(workspaceId: string, limit: number = 200): Promise<Array<SalesOrderListRow>> {
        const orders = await this.entityManager.find(OrderEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: Math.min(LIST_MAX, Math.max(1, limit)),
        })
        const customers = await this.leads.cardsOf(
            workspaceId,
            orders.flatMap((order) => (order.leadId === null ? [] : [order.leadId])),
        )
        const customerOf = new Map(customers.map((customer) => [customer.id, customer]))
        return orders.map((order) => {
            const customer = customerOf.get(order.leadId ?? "")
            return {
                ...toOrderRow(order),
                contact_name: customer?.contactName ?? null,
                company: customer?.company ?? null,
            }
        })
    }

    /** The newest orders of any status reduced to the number and customer a message may name, bounded by the caller. */
    async recentRefs(workspaceId: string, limit: number): Promise<Array<OrderRef>> {
        const orders = await this.entityManager.find(OrderEntity, {
            select: { id: true, orderNo: true, leadId: true },
            where: { workspaceId },
            order: { createdAt: "DESC", id: "DESC" },
            take: limit,
        })
        return orders.map((order) => ({ id: order.id, orderNo: order.orderNo, leadId: order.leadId }))
    }

    /** A bounded page of orders in immutable creation and id order. */
    listPage(workspaceId: string, request: PageRequest = {}): Promise<Connection<SalesOrderRow>> {
        return readConnection(request, `salesOrders:${workspaceId}`, ([cursorAt, cursorId, size]) => {
            const query = this.entityManager
                .createQueryBuilder(OrderEntity, "o")
                .select("o.id", "id")
                .addSelect("o.workspace_id", "workspace_id")
                .addSelect("o.lead_id", "lead_id")
                .addSelect("o.inbound_event_id", "inbound_event_id")
                .addSelect("o.order_no", "order_no")
                .addSelect("o.items", "items")
                .addSelect("o.amount_vnd::float8", "amount_vnd")
                .addSelect("o.status", "status")
                .addSelect("o.confirmed_by", "confirmed_by")
                .addSelect("to_json(o.created_at) #>> '{}'", "created_at")
                .addSelect("to_json(o.confirmed_at) #>> '{}'", "confirmed_at")
                .addSelect("to_json(o.shipped_at) #>> '{}'", "shipped_at")
                .addSelect("o.carrier", "carrier")
                .addSelect("o.tracking_code", "tracking_code")
                .where("o.workspaceId = :workspaceId", { workspaceId })
            if (cursorAt !== null) {
                query.andWhere("(o.created_at, o.id) < (:cursorAt::timestamptz, :cursorId::uuid)", {
                    cursorAt,
                    cursorId,
                })
            }
            return query.orderBy("o.createdAt", "DESC").addOrderBy("o.id", "DESC").limit(size).getRawMany<PagedOrder>()
        })
    }

    /** The latest non-draft orders for the Sales workbench. */
    async listForWorkbench(workspaceId: string, limit: number = 200): Promise<Array<OrdersWorkbenchRow>> {
        const orders = await this.entityManager.find(OrderEntity, {
            where: { workspaceId, status: Not("draft") },
            order: { createdAt: "DESC", id: "DESC" },
            take: Math.min(LIST_MAX, Math.max(1, limit)),
        })
        return orders.map(toOrderRow)
    }

    /** The orders shown on a customer's journey. */
    async listForLead(workspaceId: string, leadId: string): Promise<Array<OrdersWorkbenchRow>> {
        const orders = await this.entityManager.find(OrderEntity, {
            where: { workspaceId, leadId },
            order: { createdAt: "DESC", id: "DESC" },
            take: LEAD_ORDERS_LIMIT,
        })
        return orders.map(toOrderRow)
    }

    /** Records a shipment once; null means the order was missing, ineligible or already shipped. */
    async ship(
        workspaceId: string,
        orderId: string,
        carrier: string,
        trackingCode: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalOrdersWorkbench> {
        const shipped = await manager
            .createQueryBuilder(OrderEntity, "o")
            .update()
            .set({ carrier, trackingCode, shippedAt: this.clock.now() })
            .where({ workspaceId, id: orderId, status: In([...SHIPPABLE]), shippedAt: IsNull() })
            .returning("*")
            .execute()
        const [row] = shipped.raw as Array<WrittenOrder>
        return row === undefined ? null : fromWritten(row)
    }

    /** The number and items of the given orders. */
    async labelsOf(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<OrderLabel>> {
        if (orderIds.length === 0) return []
        const orders = await this.entityManager.find(OrderEntity, {
            select: { id: true, orderNo: true, items: true },
            where: { workspaceId, id: In([...orderIds]) },
            take: LABELS_LIMIT,
        })
        return orders.map((order) => ({ id: order.id, order_no: order.orderNo, items: order.items }))
    }

    /** Writes a draft order under a free number; a number the channel gave that is taken gets a suffix. */
    async draft(input: NewOrderDraft): Promise<SalesOrderRow> {
        const prefix = orderPrefixOf(this.clock.now())
        const taken = input.orderNo === null ? await this.takenToday(input.workspaceId, prefix) : 0
        return this.insertDraft(input, prefix, taken, 0)
    }

    /**
     * Confirms a draft; answers null when the order is no longer a draft, so a repeated confirmation changes nothing. A supplied
     * manager keeps the write in the caller's transaction.
     */
    async confirm(
        confirmation: OrderConfirmation,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalOrder> {
        const confirmed = await manager
            .createQueryBuilder(OrderEntity, "o")
            .update()
            .set({
                status: "confirmed",
                amountVnd: confirmation.amountVnd,
                items: confirmation.items,
                confirmedBy: confirmation.confirmedBy,
                confirmedAt: this.clock.now(),
            })
            .where({ workspaceId: confirmation.workspaceId, id: confirmation.orderId, status: "draft" })
            .returning("*")
            .execute()
        const [row] = confirmed.raw as Array<WrittenOrder>
        return row === undefined ? null : fromWritten(row)
    }

    /** Cancels a draft and answers it; null when the order is no longer a draft. */
    async cancel(workspaceId: string, orderId: string): Promise<OptionalOrder> {
        const cancelled = await this.entityManager
            .createQueryBuilder(OrderEntity, "o")
            .update()
            .set({ status: "cancelled" })
            .where({ workspaceId, id: orderId, status: "draft" })
            .returning("*")
            .execute()
        const [row] = cancelled.raw as Array<WrittenOrder>
        return row === undefined ? null : fromWritten(row)
    }

    /** The order has an invoice. */
    async markInvoiced(workspaceId: string, orderId: string): Promise<void> {
        await this.entityManager.update(
            OrderEntity,
            { workspaceId, id: orderId, status: Not("cancelled") },
            { status: "invoiced" },
        )
    }

    /** The order is paid; a supplied manager keeps the write in the caller's transaction. */
    async markPaid(workspaceId: string, orderId: string, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.update(OrderEntity, { workspaceId, id: orderId, status: Not("cancelled") }, { status: "paid" })
    }

    private takenToday(workspaceId: string, prefix: string): Promise<number> {
        return this.entityManager.count(OrderEntity, { where: { workspaceId, orderNo: Like(`${prefix}%`) } })
    }

    private async insertDraft(
        input: NewOrderDraft,
        prefix: string,
        taken: number,
        attempt: number,
    ): Promise<SalesOrderRow> {
        if (attempt >= ORDER_NUMBER_ATTEMPTS) throw new OrdersError({ code: OrdersErrorCode.NotNumbered })
        const inserted = await this.entityManager
            .createQueryBuilder(OrderEntity, "o")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                leadId: input.leadId,
                inboundEventId: input.inboundEventId,
                orderNo: orderNumberOf(input.orderNo, prefix, taken, attempt),
                items: input.items,
                amountVnd: input.amountVnd,
                status: "draft",
            })
            .orIgnore()
            .returning("*")
            .execute()
        const [row] = inserted.raw as Array<WrittenOrder>
        return row === undefined ? this.insertDraft(input, prefix, taken, attempt + 1) : fromWritten(row)
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { newOrderCode } from "./order-code.policy"
import { PaymentOrdersError, PaymentOrdersErrorCode } from "./errors/payment-orders.error"
import type { NewOrder, OpenOrderQuery, OrderLookup, PaymentOrder } from "./payment-orders.contracts"
import { toPaymentOrder } from "./payment-orders.mapper"
import type { OrderRow } from "./persistence/payment-orders.rows"
import {
    INSERT_PAYMENT_ORDER,
    SELECT_OPEN_PLAN_ORDER,
    SELECT_OPEN_TOPUP_ORDER,
    SELECT_OPEN_UPGRADE_ORDER,
    SELECT_PAYMENT_ORDER,
    SELECT_PAYMENT_ORDERS,
} from "./persistence/payment-orders.sql"

/** How many order codes are drawn before giving up on a collision streak. */
const CODE_ATTEMPTS = 5

@Injectable()
/** The payment orders: the only writer of public.payment_orders. Settlement happens in SQL when the transfer arrives. */
export class PaymentOrdersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The newest payment orders of a workspace; the application proves membership before calling this read. */
    async list(workspaceId: string): Promise<Array<PaymentOrder>> {
        const rows = await this.entityManager.query<Array<OrderRow>>(SELECT_PAYMENT_ORDERS, [workspaceId])
        return rows.map(toPaymentOrder)
    }

    /** One workspace-scoped order; reads a lapsed pending order as expired without writing during a read. */
    async find(workspaceId: string, orderId: string): Promise<OrderLookup> {
        const [row] = await this.entityManager.query<Array<OrderRow>>(SELECT_PAYMENT_ORDER, [workspaceId, orderId])
        if (row === undefined) return null
        const order = toPaymentOrder(row)
        return order.status === "pending" && new Date(order.expiresAt).getTime() < this.clock.now().getTime()
            ? { ...order, status: "expired" }
            : order
    }

    /** The newest plan order of a workspace that can still be paid. */
    async findOpenPlan(workspaceId: string): Promise<OrderLookup> {
        const [row] = await this.entityManager.query<Array<OrderRow>>(SELECT_OPEN_PLAN_ORDER, [
            workspaceId,
            this.clock.now(),
        ])
        return row === undefined ? null : toPaymentOrder(row)
    }

    /** Writes a pending payment order, drawing a new order code when the drawn one is taken. */
    async create(order: NewOrder): Promise<PaymentOrder> {
        const attempt = async (left: number): Promise<PaymentOrder> => {
            if (left === 0) throw new PaymentOrdersError({ code: PaymentOrdersErrorCode.CodeExhausted })
            const [row] = await this.entityManager.query<Array<OrderRow>>(INSERT_PAYMENT_ORDER, [
                order.workspaceId,
                order.userId,
                order.planCode,
                order.amountVnd,
                newOrderCode(),
                order.kind,
                order.packCode,
                JSON.stringify(order.detail),
            ])
            return row === undefined ? attempt(left - 1) : toPaymentOrder(row)
        }
        return await attempt(CODE_ATTEMPTS)
    }

    /** The pending, unexpired top-up order that already asks for exactly this pack and amount, so a double click shows one QR. */
    findOpenTopup(query: OpenOrderQuery): Promise<OrderLookup> {
        return this.findOpen("topup", query)
    }

    /** The pending, unexpired upgrade order that already asks for exactly this plan and amount. */
    findOpenUpgrade(query: OpenOrderQuery): Promise<OrderLookup> {
        return this.findOpen("upgrade", query)
    }

    private async findOpen(kind: "topup" | "upgrade", query: OpenOrderQuery): Promise<OrderLookup> {
        const statement = kind === "topup" ? SELECT_OPEN_TOPUP_ORDER : SELECT_OPEN_UPGRADE_ORDER
        const [row] = await this.entityManager.query<Array<OrderRow>>(statement, [
            query.workspaceId,
            query.target,
            query.amountVnd,
            this.clock.now(),
        ])
        return row === undefined ? null : toPaymentOrder(row)
    }
}

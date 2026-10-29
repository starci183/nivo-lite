import { Injectable } from "@nestjs/common"
import { In, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import { newOrderCode } from "./order-code.policy"
import { PaymentOrdersError, PaymentOrdersErrorCode } from "./errors/payment-orders.error"
import type { NewOrder, OpenOrderQuery, OrderLookup, PaymentOrder } from "./payment-orders.contracts"
import { toPaymentOrder } from "./payment-orders.mapper"
import { PaymentOrderEntity } from "./persistence/entities"

/** How many of the newest orders of a workspace are listed. */
const LIST_LIMIT = 50

/** How many ids one membership check reads. */
const IDS_LIMIT = 500

/** The row an insert answers with `RETURNING id`, to the transaction that won the order code. */
const isWrittenId = rowShape({ id: "string" })

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
        const rows = await this.entityManager.find(PaymentOrderEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: LIST_LIMIT,
        })
        return rows.map(toPaymentOrder)
    }

    /** The ids among the given ones that are orders of the workspace. */
    async idsOfWorkspace(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<string>> {
        if (orderIds.length === 0) return []
        const rows = await this.entityManager.find(PaymentOrderEntity, {
            select: { id: true },
            where: { workspaceId, id: In([...new Set(orderIds)]) },
            take: IDS_LIMIT,
        })
        return rows.map((row) => row.id)
    }

    /** One workspace-scoped order; reads a lapsed pending order as expired without writing during a read. */
    async find(workspaceId: string, orderId: string): Promise<OrderLookup> {
        const row = await this.entityManager.findOne(PaymentOrderEntity, { where: { workspaceId, id: orderId } })
        if (row === null) return null
        const order = toPaymentOrder(row)
        return order.status === "pending" && new Date(order.expiresAt).getTime() < this.clock.now().getTime()
            ? { ...order, status: "expired" }
            : order
    }

    /** The newest plan order of a workspace that can still be paid. */
    async findOpenPlan(workspaceId: string): Promise<OrderLookup> {
        const row = await this.entityManager.findOne(PaymentOrderEntity, {
            where: { workspaceId, kind: "plan", status: "pending", expiresAt: MoreThan(this.clock.now()) },
            order: { createdAt: "DESC" },
        })
        return row === null ? null : toPaymentOrder(row)
    }

    /** Writes a pending payment order, drawing a new order code when the drawn one is taken. */
    async create(order: NewOrder): Promise<PaymentOrder> {
        const attempt = async (left: number): Promise<PaymentOrder> => {
            if (left === 0) throw new PaymentOrdersError({ code: PaymentOrdersErrorCode.CodeExhausted })
            const inserted = await this.entityManager
                .createQueryBuilder(PaymentOrderEntity, "p")
                .insert()
                .values({
                    workspaceId: order.workspaceId,
                    createdBy: order.userId,
                    planCode: order.planCode,
                    amountVnd: order.amountVnd,
                    orderCode: newOrderCode(),
                    kind: order.kind,
                    packCode: order.packCode,
                    detail: order.detail,
                })
                .orUpdate(["order_code"], ["order_code"], { skipUpdateIfNoValuesChanged: true })
                .returning("id")
                .execute()
            const [written] = returnedRows(inserted.raw, isWrittenId)
            if (written === undefined) return attempt(left - 1)
            return toPaymentOrder(await this.entityManager.findOneOrFail(PaymentOrderEntity, { where: { id: written.id } }))
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

    /** The pending, unexpired add-on pack order that already asks for exactly these credits and amount. */
    findOpenCreditPack(query: OpenOrderQuery): Promise<OrderLookup> {
        return this.findOpen("credit_pack", query)
    }

    private async findOpen(kind: "topup" | "upgrade" | "credit_pack", query: OpenOrderQuery): Promise<OrderLookup> {
        const open = this.entityManager
            .createQueryBuilder(PaymentOrderEntity, "o")
            .where("o.workspaceId = :workspaceId AND o.kind = :kind AND o.status = 'pending'", {
                workspaceId: query.workspaceId,
                kind,
            })
            .andWhere("o.amountVnd = :amountVnd AND o.expiresAt > :now", {
                amountVnd: query.amountVnd,
                now: this.clock.now(),
            })
        if (kind === "topup") open.andWhere("o.packCode = :target", { target: query.target })
        if (kind === "upgrade") open.andWhere("o.planCode = :target", { target: query.target })
        if (kind === "credit_pack") open.andWhere("o.detail ->> 'credits' = :target", { target: query.target })
        const row = await open.orderBy("o.createdAt", "DESC").limit(1).getOne()
        return row === null ? null : toPaymentOrder(row)
    }
}

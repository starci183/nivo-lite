import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { GraphNodeRegistryService, rowsAnswering } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { LeadReadService } from "@modules/domain/leads"
import { z } from "zod"
import { OrdersError, OrdersErrorCode } from "./errors/orders.error"
import type { SalesOrderRow } from "./orders.contracts"
import { OrderConfirmationService } from "./order-confirmation.service"
import { OrdersService } from "./orders.service"
import { itemLinesOf, itemsTextOf } from "./order-items.policy"

/** The most orders one workspace read looks through. */
const WORKSPACE_LIMIT = 500

/** Who the node says confirmed the order. */
const CONFIRMED_BY = "NIVO"

const recordPayload = z.object({
    leadId: z.string().min(1),
    items: z.array(z.object({ name: z.string(), qty: z.number() })).min(1),
    amountVnd: z.number().nullable(),
    note: z.string().optional(),
})

const confirmPayload = z.object({ orderId: z.string().min(1) })

/** The order as the `order` data kind names its fields. */
const rowOf = (order: SalesOrderRow): NodeRow => ({
    id: order.id,
    orderNo: order.order_no,
    leadId: order.lead_id,
    items: itemLinesOf(order.items),
    note: order.note,
    amountVnd: order.amount_vnd,
    status: order.status,
    confirmedAt: order.confirmed_at,
    createdAt: order.created_at,
})

@Injectable()
/**
 * The orders as graph nodes see them: the `order` data port, and the executors of the `order.record` and `order.confirm` effects, over
 * the orders capability. Every read and write names the turn's workspace; a turn read reaches the order the turn is about or the orders
 * of the customer it is about.
 */
export class OrdersGraphService implements OnModuleInit {
    constructor(
        private readonly orders: OrdersService,
        private readonly leads: LeadReadService,
        private readonly confirmation: OrderConfirmationService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port and the executors when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addDataPort({ kind: "order", read: (turn, query, scope) => this.read(turn, query, scope) })
        this.registry?.addExecutor({ effect: "order.record", execute: (turn, payload) => this.record(turn, payload) })
        this.registry?.addExecutor({ effect: "order.confirm", execute: (turn, payload) => this.confirm(turn, payload) })
    }

    private async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const found =
            scope === "workspace" ? await this.orders.list(turn.workspaceId, WORKSPACE_LIMIT) : await this.linked(turn)
        return rowsAnswering(found.map(rowOf), query)
    }

    private async linked(turn: NodeTurn): Promise<ReadonlyArray<SalesOrderRow>> {
        const { subject, workspaceId } = turn
        if (subject?.kind === "order") {
            const order = await this.orders.find(workspaceId, subject.id)
            return order === null ? [] : [order]
        }
        return subject?.kind === "sales-lead" ? this.orders.listForLead(workspaceId, subject.id) : []
    }

    private async record(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const given = recordPayload.parse(payload)
        await this.leads.require(turn.workspaceId, given.leadId)
        const order = await this.orders.draft({
            workspaceId: turn.workspaceId,
            leadId: given.leadId,
            inboundEventId: null,
            orderNo: null,
            items: itemsTextOf(given.items),
            note: given.note ?? "",
            amountVnd: given.amountVnd,
        })
        return { kind: "order", id: order.id }
    }

    private async confirm(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { orderId } = confirmPayload.parse(payload)
        const order = await this.orders.find(turn.workspaceId, orderId)
        if (order === null) throw new OrdersError({ code: OrdersErrorCode.NotFound, params: { id: orderId } })
        if (order.status === "draft") {
            await this.confirmation.confirm({
                workspaceId: turn.workspaceId,
                orderId,
                amountVnd: order.amount_vnd,
                items: order.items,
                confirmedBy: CONFIRMED_BY,
                customer: "",
            })
        }
        return { kind: "order", id: orderId }
    }
}

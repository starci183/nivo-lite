import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { rematchJob } from "@nivo-lite/blocks-core/modules/accounting"
import { AGENT_NAME, ORDER_FIELDS, leadRowOf, orderRowOf, type OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import { itemsTextOf, pricedLinesOf, stageAfterConfirm } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { OPEN_ORDER, isRecordId, payloadOf, standsFor, type OrderRequest } from "./sales-effects.policy"
import { confirmSchema, recordSchema, rematchSchema, voidSchema } from "./sales-effects.schema"

/** The most open orders of one customer the lookup compares with the request. */
const OPEN_ORDERS_LOOKED_AT = 20

const LEAD = "sales.lead"
const ORDER = "sales.order"

/** The subject a record is, for the ledger of the host. */
const subjectOf = (id: string): SubjectRef => ({ kind: "order", id })

@Injectable()
/**
 * The executors of `order.record`, `order.confirm` and `order.void` on the entity engine, each in one workspace-scoped transaction.
 * Recording makes a draft for a customer (the engine mints its number). Confirming confirms a draft once, in the name of the agent,
 * and wins the customer's deal unless it was lost. Voiding cuts a recorded order short: it is marked `failed_system` with every field
 * kept, once; an order that is already so, or is gone, changes nothing.
 */
export class OrderEffectsService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executors when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({ effect: "order.record", execute: (turn, payload) => this.record(turn, payload) })
        this.registry?.addExecutor({ effect: "order.confirm", execute: (turn, payload) => this.confirm(turn, payload) })
        this.registry?.addExecutor({ effect: "order.void", execute: (turn, payload) => this.void(turn, payload) })
        this.registry?.addExecutor({
            effect: "payment.rematch",
            execute: (turn, payload, call) => this.rematch(turn, payload, call),
        })
    }

    /**
     * Asks the engine to look again for a credit that arrived before the order had a payment code: it enqueues the declared
     * `payment.rematch` job for the order in the same transaction, with the instant of this run from the engine clock. The effect key
     * of the call is the delivery key, so the order is looked at again once however often the node runs.
     */
    private async rematch(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const { orderId } = payloadOf(rematchSchema, payload)
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const record = isRecordId(orderId) ? await api.get(ORDER, orderId) : null
            if (record === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.OrderNotFound })
            await this.ports
                .outboxApi((use) => use(tx))
                .enqueue(
                    rematchJob,
                    { orderId, at: this.clock.now().toISOString() },
                    { dedupeKey: call.dedupeKey ?? call.key },
                )
            return subjectOf(orderId)
        })
    }

    private async record(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const given = payloadOf(recordSchema, payload)
        return await this.inScope(turn, async (api) => {
            const lead = isRecordId(given.leadId) ? await api.get(LEAD, given.leadId) : null
            if (lead === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.LeadNotFound })
            const lines = pricedLinesOf(given.items)
            const standing = await this.openOrderFor(api, lead.id, {
                lines,
                amountVnd: given.amountVnd,
                note: given.note ?? "",
            })
            if (standing !== null) return subjectOf(standing.id)
            const made = await api.insert(
                ORDER,
                {
                    leadId: lead.id,
                    items: { lines },
                    itemsText: itemsTextOf(given.items),
                    amountVnd: given.amountVnd,
                    ...(given.note === undefined ? {} : { note: given.note }),
                },
                { lead: lead.id },
            )
            if (!made.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return subjectOf(made.row.id)
        })
    }

    /** The newest open order of the customer that already stands for the request, or null. */
    private async openOrderFor(api: EntitiesApi, leadId: string, request: OrderRequest): Promise<OrderRow | null> {
        const page = await api.list({
            from: ORDER,
            select: ORDER_FIELDS,
            where: q.and(q.eq("leadId", leadId), q.in("status", OPEN_ORDER)),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: OPEN_ORDERS_LOOKED_AT },
        })
        return (
            page.rows
                .map((listed) => orderRowOf(listed.row))
                .find((order) => order !== null && standsFor(order, request)) ?? null
        )
    }

    private async confirm(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { orderId } = payloadOf(confirmSchema, payload)
        return await this.inScope(turn, async (api) => {
            const record = isRecordId(orderId) ? await api.get(ORDER, orderId) : null
            const order = record === null ? null : orderRowOf(record)
            if (order === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.OrderNotFound })
            if (order.status !== "draft") return subjectOf(order.id)
            const written = await api.update(ORDER, order.id, order.version, {
                status: "confirmed",
                confirmedBy: AGENT_NAME,
                confirmedAt: this.clock.now().toISOString(),
            })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            await this.winDeal(api, order.leadId)
            return subjectOf(order.id)
        })
    }

    /** Wins the customer's deal after a confirmation, unless it was lost or is won already. */
    private async winDeal(api: EntitiesApi, leadId: string | null): Promise<void> {
        const record = leadId === null ? null : await api.get(LEAD, leadId)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return
        const stage = stageAfterConfirm(lead.stage)
        if (stage === lead.stage) return
        const won = await api.update(LEAD, lead.id, lead.version, { stage, closedReason: null })
        if (!won.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
    }

    private async void(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { id } = payloadOf(voidSchema, payload)
        return await this.inScope(turn, async (api) => {
            const record = isRecordId(id) ? await api.get(ORDER, id) : null
            const order = record === null ? null : orderRowOf(record)
            if (order === null || order.status === "failed_system") return subjectOf(id)
            const written = await api.update(ORDER, order.id, order.version, { status: "failed_system" })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return subjectOf(id)
        })
    }

    /** Runs the effect in one transaction scoped to the workspace of the turn. */
    private inScope<T>(turn: NodeTurn, work: (api: EntitiesApi) => Promise<T>): Promise<T> {
        return this.engine.scoped(turn.workspaceId, (tx) => work(this.ports.entitiesApi((use) => use(tx), "action")))
    }
}

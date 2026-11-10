import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { TOOL, refusalOf } from "@nivo-lite/blocks-core"
import type { EffectFact } from "@nivo-lite/blocks-core"
import { rematchJob } from "@nivo-lite/blocks-core/modules/accounting"
import { AGENT_NAME, ORDER_FIELDS, leadRowOf, orderRowOf, settingsOf } from "@nivo-lite/blocks-core/modules/sales"
import { confirmDecision, itemsTextOf, waitsForOwner } from "@nivo-lite/blocks-core/rules/sales"
import type { SalesSettings } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { PaymentTimersService } from "./payment-timers.service"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { OPEN_ORDER, isRecordId, payloadOf, pricedFromCatalogue, standsFor, textOrNull } from "./sales-effects.policy"
import type { CatalogueRow, OrderRequest } from "./sales-effects.policy"
import type { OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import { confirmSchema, recordSchema, rematchSchema, voidSchema } from "./sales-effects.schema"

/** The most open orders of one customer the lookup compares with the request. */
const OPEN_ORDERS_LOOKED_AT = 20

const LEAD = "sales.lead"
const ORDER = "sales.order"
const SETTINGS = "sales.settings"

/** The data kind the shop's catalogue is read through. */
const CATALOGUE = "catalogue-item"

/** The most catalogue items read to price an order. */
const CATALOGUE_ROWS = 500

/** A catalogue row as the data port answers it, read to the members pricing needs; null when it is not one. */
const catalogueRowOf = (row: Readonly<Record<string, unknown>>): CatalogueRow | null =>
    typeof row.id === "string" && typeof row.name === "string"
        ? {
              id: row.id,
              name: row.name,
              priceVnd: typeof row.priceVnd === "number" ? row.priceVnd : null,
              active: row.active !== false,
          }
        : null

/** What an order answers its caller: the number, where it stands, the total and the lines, all from the record. */
const orderFacts = (
    order: Pick<
        OrderRow,
        "orderNo" | "status" | "amountVnd" | "items" | "deliveryAddress" | "recipientName" | "recipientPhone" | "deliveryAt"
    >,
): EffectFact["facts"] => ({
    orderNo: order.orderNo,
    status: order.status,
    amountVnd: order.amountVnd,
    lines: order.items.lines.map((line) => ({ ...line })),
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryAt: order.deliveryAt,
})

/** The subject a record is, for the ledger of the host. */
const subjectOf = (id: string): SubjectRef => ({ kind: "order", id })

@Injectable()
/**
 * The executors of `order.record`, `order.confirm` and `order.void` on the entity engine, each in one workspace-scoped transaction.
 * - Recording makes a draft for a customer (the engine mints its number). The caller names what and how many; every price and the total
 *   are the catalogue's, read here, so nothing a caller says can set an amount. An item the catalogue does not list or has not priced is
 *   answered as a refusal fact and nothing is written.
 * - Confirming confirms a confirmable order once, in the name of the agent, and answers the customer's deal stage as a fact; it moves
 *   no deal (winning it is a step of the graph, from the policy). It enforces no business limit: the owner-approval threshold of the Sales settings is policy the agent reasons about (the recorded
 *   order's facts carry `waitsOwner` and `thresholdVnd`), never a refusal here. Only the order's state refuses (`order_missing`,
 *   `not_confirmable`).
 * - Voiding cuts a recorded order short: it is marked `failed_system` with every field kept, once; an order that is already so, or is
 *   gone, changes nothing.
 * A refusal is a fact the step's agent reads (`refused`, the reason, the true values); only a write the engine did not make is thrown.
 */
export class OrderEffectsService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly timers?: PaymentTimersService,
    ) {}

    /** Registers the executors when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({ effect: TOOL.orderRecord, execute: (turn, payload) => this.record(turn, payload) })
        this.registry?.addExecutor({
            effect: TOOL.orderConfirm,
            execute: (turn, payload) => this.confirm(turn, payload),
        })
        this.registry?.addExecutor({ effect: TOOL.orderVoid, execute: (turn, payload) => this.void(turn, payload) })
        this.registry?.addExecutor({
            effect: TOOL.paymentRematch,
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

    private async record(turn: NodeTurn, payload: EffectPayload): Promise<EffectFact> {
        const given = payloadOf(recordSchema, payload)
        const priced = pricedFromCatalogue(given.items, await this.catalogue(turn))
        if ("refused" in priced) return refusalOf(priced.refused, { name: priced.name })
        const request: OrderRequest = {
            lines: priced.lines,
            amountVnd: priced.lines.reduce((sum, line) => sum + line.amountVnd, 0),
            note: textOrNull(given.note) ?? "",
            deliveryAddress: textOrNull(given.address),
            recipientName: textOrNull(given.recipientName),
            recipientPhone: textOrNull(given.recipientPhone),
            deliveryAt: textOrNull(given.deliveryAt),
        }
        return await this.inScope(turn, async (api, runIn) => {
            const lead = isRecordId(given.leadId) ? await api.get(LEAD, given.leadId) : null
            if (lead === null) return refusalOf("lead_missing")
            const settings = await this.settings(runIn)
            const standing = await this.openOrderFor(api, lead.id, request)
            if (standing !== null) return this.recorded(standing, settings)
            const values = {
                items: { lines: request.lines },
                itemsText: itemsTextOf(request.lines),
                amountVnd: request.amountVnd,
                note: request.note,
                deliveryAddress: request.deliveryAddress,
                recipientName: request.recipientName,
                recipientPhone: request.recipientPhone,
                deliveryAt: request.deliveryAt,
            }
            const draft = await this.draftOf(api, lead.id, given.orderId)
            const written =
                draft === null
                    ? await api.insert(ORDER, { leadId: lead.id, ...values }, { lead: lead.id })
                    : await api.update(ORDER, draft.id, draft.version, values)
            const order = written.ok ? orderRowOf(written.row) : null
            if (order === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return this.recorded(order, settings)
        })
    }

    /** The fact of a recorded order: its number, lines and total, and whether it waits for the owner at the workspace's threshold. */
    private recorded(order: OrderRow, settings: SalesSettings): EffectFact {
        return {
            ...subjectOf(order.id),
            facts: {
                ...orderFacts(order),
                waitsOwner: waitsForOwner(order, settings),
                thresholdVnd: settings.approvalThresholdVnd,
            },
        }
    }

    /** The shop's catalogue, read through its data port; empty when the app serves none, so every item is then refused as unknown. */
    private async catalogue(turn: NodeTurn): Promise<ReadonlyArray<CatalogueRow>> {
        if (this.registry === undefined) return []
        const rows = await this.registry
            .portOf(CATALOGUE)
            .read(turn, { fields: ["id", "name", "priceVnd", "active"], limit: CATALOGUE_ROWS }, "workspace")
        return rows.flatMap((row) => catalogueRowOf(row) ?? [])
    }

    /** The sales rules the workspace saved, else the defaults. */
    private settings(runIn: RunIn): Promise<SalesSettings> {
        return settingsOf(this.ports.entityApi(runIn, "action", SETTINGS))
    }

    /**
     * The draft the caller named for this customer (`orderId`), which the new request rewrites: one order per customer while it is
     * open, never a second. Null when none is named, or it is not a draft of theirs (a confirmed or paid order is never rewritten: the
     * request becomes a new order).
     */
    private async draftOf(api: EntitiesApi, leadId: string, orderId: string | undefined): Promise<OrderRow | null> {
        if (orderId === undefined || !isRecordId(orderId)) return null
        const record = await api.get(ORDER, orderId)
        const order = record === null ? null : orderRowOf(record)
        return order?.leadId === leadId && order.status === "draft" ? order : null
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

    private async confirm(turn: NodeTurn, payload: EffectPayload): Promise<EffectFact> {
        const { orderId } = payloadOf(confirmSchema, payload)
        return await this.inScope(turn, async (api, runIn) => {
            const record = isRecordId(orderId) ? await api.get(ORDER, orderId) : null
            const order = record === null ? null : orderRowOf(record)
            if (order === null) return refusalOf("order_missing")
            const settings = await this.settings(runIn)
            const decision = confirmDecision({
                status: order.status,
                amountVnd: order.amountVnd,
                settings,
                byOwner: false,
            })
            if (decision.kind === "refused") return refusalOf("not_confirmable", { status: order.status })
            const dealStage = await this.dealStageOf(api, order.leadId)
            if (decision.kind === "already") return { ...subjectOf(order.id), facts: { ...orderFacts(order), dealStage } }
            const written = await api.update(ORDER, order.id, order.version, {
                status: "confirmed",
                confirmedBy: AGENT_NAME,
                confirmedAt: this.clock.now().toISOString(),
            })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return { ...subjectOf(order.id), facts: { ...orderFacts({ ...order, status: "confirmed" }), dealStage } }
        })
    }

    /**
     * The pipeline stage of the customer's deal, as a fact: confirming an order moves no deal. Whether the deal is now won is the agent's
     * call from the policy (`autoWon`), through `lead.stage.update`. Null when the order has no customer the workspace holds.
     */
    private async dealStageOf(api: EntitiesApi, leadId: string | null): Promise<string | null> {
        const record = leadId === null ? null : await api.get(LEAD, leadId)
        return (record === null ? null : leadRowOf(record))?.stage ?? null
    }

    private async void(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { id } = payloadOf(voidSchema, payload)
        const voided = await this.inScope(turn, async (api) => {
            const record = isRecordId(id) ? await api.get(ORDER, id) : null
            const order = record === null ? null : orderRowOf(record)
            if (order === null || order.status === "failed_system") return subjectOf(id)
            const written = await api.update(ORDER, order.id, order.version, { status: "failed_system" })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return subjectOf(id)
        })
        // A cut order waits for no money: its payment timers, if any were armed, have nothing left to wake for.
        if (isRecordId(id)) await this.timers?.closeOf(turn.workspaceId, id)
        return voided
    }

    /** Runs the effect in one transaction scoped to the workspace of the turn. */
    private inScope<T>(turn: NodeTurn, work: (api: EntitiesApi, runIn: RunIn) => Promise<T>): Promise<T> {
        return this.engine.scoped(turn.workspaceId, (tx) => {
            const runIn: RunIn = (use) => use(tx)
            return work(this.ports.entitiesApi(runIn, "action"), runIn)
        })
    }
}

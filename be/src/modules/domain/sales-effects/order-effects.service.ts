import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AGENT_NAME, leadRowOf, orderRowOf } from "@nivo-lite/blocks-core/modules/sales"
import { itemsTextOf, pricedLinesOf, stageAfterConfirm } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { isRecordId, payloadOf } from "./sales-effects.policy"
import { confirmSchema, recordSchema, voidSchema } from "./sales-effects.schema"

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
    }

    private async record(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const given = payloadOf(recordSchema, payload)
        return await this.inScope(turn, async (api) => {
            const lead = isRecordId(given.leadId) ? await api.get(LEAD, given.leadId) : null
            if (lead === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.LeadNotFound })
            const made = await api.insert(
                ORDER,
                {
                    leadId: lead.id,
                    items: { lines: pricedLinesOf(given.items) },
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

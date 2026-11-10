import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { TOOL, leadStageUpdateEffect, refusalOf } from "@nivo-lite/blocks-core"
import type { EffectFact } from "@nivo-lite/blocks-core"
import { leadRowOf } from "@nivo-lite/blocks-core/modules/sales"
import { contactParts } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { q } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { LeadMemoryService, leadMemorySubjectOf } from "@modules/domain/lead-memory"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { isRecordId, payloadOf } from "./sales-effects.policy"
import { conversationSchema, ensureSchema, updateSchema } from "./sales-effects.schema"

const CONVERSATION = "chat.conversation"
const LEAD = "sales.lead"

/** The conversation the effect names and the customer it is already tied to. */
interface TiedConversation {
    /** The name the conversation is shown under. */
    readonly name: string
    /** The channel the conversation runs on. */
    readonly channel: string
    /** The customer it is tied to, or null. */
    readonly leadId: string | null
}

@Injectable()
/**
 * The executors of `nivo.lead.ensure` and `nivo.lead.update` on the entity engine, and the resolver of the customer of a turn's conversation. The customer of a
 * conversation is the one it is already linked to; else the one the chat's phone matches (the `phone` match key of `sales.lead`, so
 * two conversations of one phone share a customer); else a new one. The conversation is linked to it. It is a pivot: a customer other
 * records point at is not taken back.
 */
export class LeadEffectsService implements OnModuleInit {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly memory?: LeadMemoryService,
    ) {}

    /** Registers the executors and the resolver when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        const registry = this.registry
        if (registry === undefined) return
        registry.addExecutor({ effect: "nivo.lead.ensure", execute: (turn, payload) => this.ensure(turn, payload) })
        registry.addExecutor({ effect: "nivo.lead.update", execute: (turn, payload) => this.update(turn, payload) })
        registry.addExecutor({ effect: TOOL.leadStageUpdate, execute: (turn, payload) => this.moveStage(turn, payload) })
        registry.addSubjectResolver({ subjectOf: (turn) => this.subjectOf(turn) })
    }

    private async ensure(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { conversationId, name, phone } = payloadOf(ensureSchema, payload)
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const conversation = await this.conversationOf(api, conversationId)
            if (conversation === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.ConversationNotFound })
            if (conversation.leadId !== null) {
                await this.writeLeadField(api, conversationId, conversation.leadId)
                return { kind: "sales-lead", id: conversation.leadId }
            }
            const normalised = contactParts(phone ?? null).phone
            const values = {
                contactName: name ?? conversation.name,
                channel: conversation.channel,
                ...(normalised === null ? {} : { phone: normalised }),
            }
            const made = normalised === null ? await api.insert(LEAD, values) : await api.ensure(LEAD, "phone", values)
            if (!made.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            const linked = await api.link(CONVERSATION, conversationId, "lead", made.row.id)
            if (!linked.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            await this.writeLeadField(api, conversationId, made.row.id)
            return { kind: "sales-lead", id: made.row.id }
        })
    }

    /**
     * `nivo.lead.update`: writes the consult stage the payload names on the customer, under the version just read, and lays the facts it
     * names over the customer's lead memory (their one home: the record keeps no copy); a customer the workspace does not hold, or a
     * write another writer beat, is refused so the step is tried again. An app with no lead memory keeps the stage only.
     */
    private async update(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { leadId, consultStage, facts } = payloadOf(updateSchema, payload)
        await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const lead = isRecordId(leadId) ? await api.get(LEAD, leadId) : null
            if (lead === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.LeadNotFound })
            if (consultStage === undefined) return
            const written = await api.update(LEAD, leadId, lead.version, { consultStage })
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
        })
        if (facts !== undefined && Object.keys(facts).length > 0) {
            await this.memory?.remember(turn.workspaceId, leadMemorySubjectOf(leadId, turn.conversationId), facts)
        }
        return { kind: "sales-lead", id: leadId }
    }

    /**
     * `nivo.lead.stage.update`: moves the customer's deal to the stage named, under the version just read, and answers the stage before and
     * after as facts. A deal that leaves `lost` drops its closed reason (it no longer says why the deal was lost). The tool decides
     * nothing: when a deal is won (on a confirmed order, on payment) and whether a lost one may move are the agent's, from the policy. A
     * customer the workspace does not hold is the refusal `lead_missing`; a write another writer beat is thrown, so the step runs again.
     */
    private async moveStage(turn: NodeTurn, payload: EffectPayload): Promise<EffectFact> {
        const { leadId, stage } = payloadOf(leadStageUpdateEffect.payload, payload)
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const record = isRecordId(leadId) ? await api.get(LEAD, leadId) : null
            const lead = record === null ? null : leadRowOf(record)
            if (lead === null) return refusalOf("lead_missing", { leadId })
            const facts = { stage, previousStage: lead.stage }
            if (lead.stage === stage) return { kind: "sales-lead", id: leadId, facts }
            const values = stage === "lost" ? { stage } : { stage, closedReason: null }
            const written = await api.update(LEAD, leadId, lead.version, values)
            if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
            return { kind: "sales-lead", id: leadId, facts }
        })
    }

    /**
     * Writes the customer on the conversation's `leadId` field beside its `lead` link: the graph nodes find a customer's conversation by
     * that field (the settle confirmation, the after-sale thanks), and a conversation tied by the link alone was never found, so the
     * customer was told nothing after paying. A field that already names the customer is left as it is.
     */
    private async writeLeadField(api: EntitiesApi, conversationId: string, leadId: string): Promise<void> {
        const record = await api.get(CONVERSATION, conversationId)
        if (record === null || record.data.leadId === leadId) return
        const written = await api.update(CONVERSATION, conversationId, record.version, { leadId })
        if (!written.ok) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
    }

    /** The customer of the conversation the turn serves; null when the turn serves none or its conversation has no customer. */
    private async subjectOf(turn: NodeTurn): Promise<SubjectRef | null> {
        if (turn.conversationId === null) return null
        const conversationId = turn.conversationId
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const conversation = await this.conversationOf(
                this.ports.entitiesApi((use) => use(tx), "action"),
                conversationId,
            )
            const leadId = conversation?.leadId ?? null
            return leadId === null ? null : { kind: "sales-lead", id: leadId }
        })
    }

    /** The conversation with the customer it is linked to; null when the workspace has no conversation by this id. */
    private async conversationOf(api: EntitiesApi, id: string): Promise<TiedConversation | null> {
        if (!isRecordId(id)) return null
        const page = await api.list({
            from: CONVERSATION,
            select: ["name", "channel"],
            join: { lead: ["contactName"] },
            where: q.eq("id", id),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        const [found] = page.rows
        if (found === undefined) return null
        const parsed = conversationSchema.safeParse(found.row.data)
        return parsed.success ? { ...parsed.data, leadId: found.joined["lead"]?.id ?? null } : null
    }
}

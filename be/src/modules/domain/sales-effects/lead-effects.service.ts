import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { contactParts } from "@nivo-lite/blocks-core/rules/sales"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { q } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { isRecordId, payloadOf } from "./sales-effects.policy"
import { conversationSchema, ensureSchema } from "./sales-effects.schema"

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
 * The executor of `lead.ensure` on the entity engine, and the resolver of the customer of a turn's conversation. The customer of a
 * conversation is the one it is already linked to; else the one the chat's phone matches (the `phone` match key of `sales.lead`, so
 * two conversations of one phone share a customer); else a new one. The conversation is linked to it. It is a pivot: a customer other
 * records point at is not taken back.
 */
export class LeadEffectsService implements OnModuleInit {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor and the resolver when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({ effect: "lead.ensure", execute: (turn, payload) => this.ensure(turn, payload) })
        this.registry?.addSubjectResolver({ subjectOf: (turn) => this.subjectOf(turn) })
    }

    private async ensure(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { conversationId, name, phone } = payloadOf(ensureSchema, payload)
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const conversation = await this.conversationOf(api, conversationId)
            if (conversation === null) throw new SalesEffectsError({ code: SalesEffectsErrorCode.ConversationNotFound })
            if (conversation.leadId !== null) return { kind: "sales-lead", id: conversation.leadId }
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
            return { kind: "sales-lead", id: made.row.id }
        })
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

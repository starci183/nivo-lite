import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ApiPrincipal } from "@modules/domain/api-keys"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type {
    AcceptKnowledgeParams,
    AcceptLeadParams,
    AcceptMessageParams,
    AcceptedKnowledge,
    AcceptedLead,
    AcceptedMessage,
    EventListItem,
    EventsPage,
    LeadListItem,
    LeadStage,
} from "./public-api.contracts"
import {
    checkContent,
    cleanTags,
    contactParts,
    eventsSince,
    leadDedupeKey,
    leadEventId,
    messageDedupeKey,
    normaliseContact,
} from "./public-api.policy"
import type { ConversationsRow, EventsRow, InboundEventsRow, KnowledgeSourcesRow, LeadsRow } from "./persistence/public-api.rows"
import {
    BUMP_INBOUND_DUPLICATE,
    INSERT_EVIDENCE,
    INSERT_INBOUND_LEAD,
    INSERT_KNOWLEDGE_SOURCE,
    LIST_EVENTS,
    LIST_LEADS,
    MATCH_LEAD_BY_EMAIL,
    MATCH_LEAD_BY_NAME,
    MATCH_LEAD_BY_PHONE,
    SELECT_CONVERSATION,
    SELECT_CONVERSATION_OF_LEAD,
} from "./persistence/public-api.sql"

/** The channel a customer handed over without one is attributed to. */
const DEFAULT_CHANNEL = "API"

/** The text recorded for a customer handed over without a need. */
const DEFAULT_NEED = "Created through the API"

type LeadId = Pick<LeadsRow, "id">
type LeadRow = Pick<LeadsRow, "id" | "contact_name" | "company" | "channel" | "need" | "stage" | "phone" | "email" | "created_at">
type EventRow = Pick<EventsRow, "id" | "kind" | "actor" | "summary" | "evidence" | "lead_id" | "created_at">
type ConversationRow = Pick<ConversationsRow, "id" | "lead_id">

const toLeadItem = (row: LeadRow): LeadListItem => ({
    id: row.id,
    name: row.contact_name,
    company: row.company,
    channel: row.channel,
    need: row.need,
    stage: row.stage,
    phone: row.phone ?? null,
    email: row.email ?? null,
    createdAt: row.created_at,
})

const toEventItem = (row: EventRow): EventListItem => ({
    id: row.id,
    kind: row.kind,
    actor: row.actor,
    summary: row.summary,
    evidence: row.evidence,
    leadId: row.lead_id,
    createdAt: row.created_at,
})

@Injectable()
/** What the public API v1 reads and accepts for a workspace, reached only through the shared primary EntityManager; the follow-up work of an accepted request is a job. */
export class PublicApiService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: PublicApiQueue,
    ) {}

    /** The customers of the key's workspace, newest first, optionally of one stage. */
    async listLeads(workspaceId: string, stage: LeadStage | undefined, limit: number): Promise<Array<LeadListItem>> {
        const rows = await this.entityManager.query<Array<LeadRow>>(LIST_LEADS, [workspaceId, stage ?? null, limit])
        return rows.map(toLeadItem)
    }

    /** The evidence lines of the key's workspace after `since` (one day back when absent), oldest first, with the cursor for the next call. */
    async listEvents(workspaceId: string, since: string | undefined, limit: number): Promise<EventsPage> {
        const from = eventsSince(since, this.clock.now())
        if (from.kind === "refused") throw new PublicApiError({ code: from.code })
        const rows = await this.entityManager.query<Array<EventRow>>(LIST_EVENTS, [workspaceId, from.value, limit])
        const events = rows.map(toEventItem)
        return { events, nextSince: events.at(-1)?.createdAt ?? from.value }
    }

    /**
     * Hands a customer over: the inbound event and its hand-off job commit together, so the job exists exactly when the event does.
     * The same external id of the same key is one customer; a repeat changes nothing but its duplicate count.
     */
    async acceptLead(who: ApiPrincipal, params: AcceptLeadParams): Promise<AcceptedLead> {
        const contact = params.phone || params.email || null
        const parts = contactParts(contact)
        const channel = params.channel || DEFAULT_CHANNEL
        const eventId = leadEventId(who.keyId, params.externalId, randomUUID())
        const dedupeKey = leadDedupeKey(eventId)
        return this.entityManager.transaction(async (tx) => {
            const known = await this.matchLead(tx, who.workspaceId, parts, params.name, channel)
            const [inserted] = await tx.query<Array<Pick<InboundEventsRow, "id">>>(INSERT_INBOUND_LEAD, [
                who.workspaceId,
                params.name,
                normaliseContact(contact),
                params.need || DEFAULT_NEED,
                `api:${who.name}`,
                eventId,
                dedupeKey,
            ])
            if (inserted === undefined) {
                const [repeat] = await tx.query<Array<Pick<InboundEventsRow, "lead_id">>>(BUMP_INBOUND_DUPLICATE, [
                    who.workspaceId,
                    dedupeKey,
                ])
                return { leadId: repeat?.lead_id ?? known ?? null, status: "unchanged" }
            }
            await tx.query(INSERT_EVIDENCE, [
                who.workspaceId,
                known ?? null,
                "api.lead",
                `api:${who.name}`,
                `Customer received through the API: ${params.name}`,
                `source=api:${who.name}${params.externalId === "" ? "" : ` external_id=${params.externalId}`}`,
            ])
            await this.queue.enqueueLead(
                {
                    workspaceId: who.workspaceId,
                    keyId: who.keyId,
                    keyName: who.name,
                    inboundEventId: inserted.id,
                    company: params.company,
                    stage: params.stage,
                    note: params.note,
                },
                tx,
            )
            return { leadId: known ?? null, status: "accepted" }
        })
    }

    /** Asks the chatbot to message a customer conversation: the message is queued and the owner's authority rule decides whether it is sent or waits. */
    async acceptMessage(who: ApiPrincipal, params: AcceptMessageParams): Promise<AcceptedMessage> {
        if (params.conversationId === "" && params.leadId === "") {
            throw new PublicApiError({ code: PublicApiErrorCode.TargetMissing })
        }
        return this.entityManager.transaction(async (tx) => {
            const [conversation] =
                params.conversationId === ""
                    ? await tx.query<Array<ConversationRow>>(SELECT_CONVERSATION_OF_LEAD, [who.workspaceId, params.leadId])
                    : await tx.query<Array<ConversationRow>>(SELECT_CONVERSATION, [who.workspaceId, params.conversationId])
            if (conversation === undefined) throw new PublicApiError({ code: PublicApiErrorCode.ConversationNotFound })
            await tx.query(INSERT_EVIDENCE, [
                who.workspaceId,
                conversation.lead_id,
                "api.message",
                `api:${who.name}`,
                "Message requested through the API",
                `source=api:${who.name}`,
            ])
            await this.queue.enqueueMessage(
                {
                    workspaceId: who.workspaceId,
                    keyId: who.keyId,
                    keyName: who.name,
                    conversationId: conversation.id,
                    leadId: conversation.lead_id,
                    text: params.text,
                    requireApproval: params.requireApproval,
                    dedupeKey: messageDedupeKey(who.keyId, params.idempotencyKey ?? randomUUID(), conversation.id),
                },
                tx,
            )
            return { conversationId: conversation.id, status: "queued" }
        })
    }

    /** Adds a text knowledge source: the row and its indexing job commit together. */
    async acceptKnowledge(who: ApiPrincipal, params: AcceptKnowledgeParams): Promise<AcceptedKnowledge> {
        const content = checkContent(params.content)
        if (content.kind === "refused") throw new PublicApiError({ code: content.code, params: content.params })
        return this.entityManager.transaction(async (tx) => {
            const [source] = await tx.query<Array<Pick<KnowledgeSourcesRow, "id">>>(INSERT_KNOWLEDGE_SOURCE, [
                who.workspaceId,
                params.topic === "" ? null : params.topic,
                cleanTags(params.tags),
                params.visibility,
                params.title,
                content.value,
                `api:${who.name}`,
            ])
            if (source === undefined) throw new PublicApiError({ code: PublicApiErrorCode.NotWritten })
            await tx.query(INSERT_EVIDENCE, [
                who.workspaceId,
                null,
                "api.knowledge",
                `api:${who.name}`,
                `Knowledge added through the API: ${params.title}`,
                `source=api:${who.name} visibility=${params.visibility}`,
            ])
            await this.queue.enqueueKnowledge({ workspaceId: who.workspaceId, sourceId: source.id }, tx)
            return { id: source.id, status: "queued" }
        })
    }

    /** The customer a hand-over belongs to: by phone, then email, then name and channel when the request carries no contact at all. */
    private async matchLead(
        tx: EntityManager,
        workspaceId: string,
        parts: { phone: string | null; email: string | null },
        name: string,
        channel: string,
    ): Promise<string | undefined> {
        if (parts.phone !== null) {
            const [byPhone] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_PHONE, [workspaceId, parts.phone])
            if (byPhone !== undefined) return byPhone.id
        }
        if (parts.email !== null) {
            const [byEmail] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_EMAIL, [workspaceId, parts.email])
            if (byEmail !== undefined) return byEmail.id
        }
        if (parts.phone !== null || parts.email !== null) return undefined
        const [byName] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_NAME, [workspaceId, name, channel])
        return byName?.id
    }
}

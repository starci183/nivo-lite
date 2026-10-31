import type { EntityManager } from "typeorm"
import { eventsEntities } from "@modules/domain/events"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { leadsEntities } from "@modules/domain/leads"
import { publicApiEntities } from "@modules/domain/public-api"
import { workItemsEntities } from "@modules/domain/work-items"
import type { Proposal } from "@modules/domain/work-items"
import { inboxEntities } from "@modules/platform/inbox"
import { jobsEntities } from "@modules/platform/jobs"

const [PublicApiEntity] = publicApiEntities

const [WorkItemEntity] = workItemsEntities

const [InboxEntity] = inboxEntities

const [EventEntity] = eventsEntities
const [InboundEventEntity] = inboundEventsEntities
const [LeadEntity] = leadsEntities
const [KnowledgeSourceEntity] = knowledgeSourcesEntities
const [, JobOutboxEntity] = jobsEntities

/** The ledger state the proof observes through a separate transaction. */
export interface PublicApiRequestState {
    readonly id: string
    readonly kind: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly need_supplied: boolean | null
    readonly lead_id: string | null
    readonly processed_at: Date | null
}

/** A durable downstream item, retained for approval and replay assertions. */
export interface PublicApiWorkState {
    readonly id: string
    readonly action: string
    readonly status: string
    readonly subject_type: string
    readonly subject_id: string | null
    readonly lead_id: string | null
    readonly inbound_event_id: string | null
    readonly dedupe_key: string
    readonly proposal: Proposal
    readonly reason: string | null
}

/** The retained facts of a customer. */
export interface PublicApiLeadState {
    readonly id: string
    readonly need: string
    readonly company: string
    readonly channel: string
    readonly stage: string
}

/** The original inbound record reused by new and historical API jobs. */
export interface PublicApiInboundState {
    readonly id: string
    readonly event_id: string | null
    readonly body: string
    readonly lead_id: string | null
}

/** A source row with its normalized metadata. */
export interface PublicApiSourceState {
    readonly id: string
    readonly title: string
    readonly content: string
    readonly topic: string | null
    readonly tags: Array<string>
    readonly visibility: string
    readonly origin: string
}

/** An inbox receipt of the public API or a manual inbound input. */
export interface PublicApiInboxState {
    readonly source: string
    readonly delivery_id: string
}

/** One evidence line of the workspace. */
export interface PublicApiEventState {
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly evidence: string | null
    readonly lead_id: string | null
}

/** One queue handoff of the workspace. */
export interface PublicApiOutboxState {
    readonly id: string
    readonly queue: string
    readonly name: string
    readonly dedupe_key: string
    readonly payload: Readonly<Record<string, unknown>>
}

const requestsOf = (manager: EntityManager) =>
    manager
        .createQueryBuilder(PublicApiEntity, "p")
        .select("p.id", "id")
        .addSelect("p.kind", "kind")
        .addSelect("p.payload", "payload")
        .addSelect("p.need_supplied", "need_supplied")
        .addSelect("p.lead_id", "lead_id")
        .addSelect("p.processed_at", "processed_at")

/** The admitted request and its consumer completion, observed outside the fenced transaction. */
export const apiRequest = (
    manager: EntityManager,
    workspaceId: string,
    id: string,
): Promise<Array<PublicApiRequestState>> =>
    requestsOf(manager)
        .where("p.workspace_id = :workspaceId AND p.id = :id", { workspaceId, id })
        .getRawMany<PublicApiRequestState>()

/** The request the lead producer admitted under its caller's external identity. */
export const apiLeadRequest = (
    manager: EntityManager,
    workspaceId: string,
    externalId: string,
): Promise<Array<PublicApiRequestState>> =>
    requestsOf(manager)
        .where("p.workspace_id = :workspaceId AND p.payload ->> 'externalId' = :externalId", {
            workspaceId,
            externalId,
        })
        .limit(1)
        .getRawMany<PublicApiRequestState>()

/** The latest message admission for one isolated customer conversation. */
export const apiMessageRequest = (
    manager: EntityManager,
    workspaceId: string,
    conversationId: string,
): Promise<Array<PublicApiRequestState>> =>
    requestsOf(manager)
        .where("p.workspace_id = :workspaceId AND p.payload ->> 'conversationId' = :conversationId", {
            workspaceId,
            conversationId,
        })
        .orderBy("p.created_at", "DESC")
        .addOrderBy("p.id", "DESC")
        .limit(1)
        .getRawMany<PublicApiRequestState>()

/** Moves one isolated admission back by whole hours, as a backlog replayed after an outage. */
export const backdateApiRequest = async (
    manager: EntityManager,
    workspaceId: string,
    id: string,
    hours: number,
): Promise<void> => {
    await manager
        .createQueryBuilder(PublicApiEntity, "t")
        .update()
        .set({ createdAt: () => `created_at - make_interval(hours => ${String(Math.trunc(hours))})` })
        .where("workspace_id = :workspaceId AND id = :id", { workspaceId, id })
        .execute()
}

/** The retained facts of an existing customer. */
export const apiLead = (manager: EntityManager, workspaceId: string, id: string): Promise<Array<PublicApiLeadState>> =>
    manager
        .createQueryBuilder(LeadEntity, "l")
        .select("l.id", "id")
        .addSelect("l.need", "need")
        .addSelect("l.company", "company")
        .addSelect("l.channel", "channel")
        .addSelect("l.stage", "stage")
        .where("l.workspace_id = :workspaceId AND l.id = :id", { workspaceId, id })
        .getRawMany<PublicApiLeadState>()

/** Every durable handoff of this isolated workspace. */
export const apiWork = (manager: EntityManager, workspaceId: string): Promise<Array<PublicApiWorkState>> =>
    manager
        .createQueryBuilder(WorkItemEntity, "w")
        .select("w.id", "id")
        .addSelect("w.action", "action")
        .addSelect("w.status", "status")
        .addSelect("w.subject_type", "subject_type")
        .addSelect("w.subject_id", "subject_id")
        .addSelect("w.lead_id", "lead_id")
        .addSelect("w.inbound_event_id", "inbound_event_id")
        .addSelect("w.dedupe_key", "dedupe_key")
        .addSelect("w.proposal", "proposal")
        .addSelect("w.reason", "reason")
        .where("w.workspace_id = :workspaceId", { workspaceId })
        .orderBy("w.created_at")
        .addOrderBy("w.id")
        .getRawMany<PublicApiWorkState>()

/** The original inbound record reused by new and historical API jobs. */
export const apiInbound = (manager: EntityManager, workspaceId: string): Promise<Array<PublicApiInboundState>> =>
    manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.id", "id")
        .addSelect("e.event_id", "event_id")
        .addSelect("e.body", "body")
        .addSelect("e.lead_id", "lead_id")
        .where("e.workspace_id = :workspaceId", { workspaceId })
        .orderBy("e.created_at")
        .addOrderBy("e.id")
        .getRawMany<PublicApiInboundState>()

/** The promised stable source identity and its normalized metadata. */
export const apiSource = (
    manager: EntityManager,
    workspaceId: string,
    id: string,
): Promise<Array<PublicApiSourceState>> =>
    manager
        .createQueryBuilder(KnowledgeSourceEntity, "k")
        .select("k.id", "id")
        .addSelect("k.title", "title")
        .addSelect("k.content", "content")
        .addSelect("k.topic", "topic")
        .addSelect("k.tags", "tags")
        .addSelect("k.visibility", "visibility")
        .addSelect("k.origin", "origin")
        .where("k.workspace_id = :workspaceId AND k.id = :id", { workspaceId, id })
        .getRawMany<PublicApiSourceState>()

/** Queue handoffs are successful fulfillment; external indexing and delivery remain separate work. */
export const apiOutbox = (manager: EntityManager, workspaceId: string): Promise<Array<PublicApiOutboxState>> =>
    manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .select("o.id", "id")
        .addSelect("o.queue", "queue")
        .addSelect("o.name", "name")
        .addSelect("o.dedupe_key", "dedupe_key")
        .addSelect("o.payload", "payload")
        .where("o.payload->>'workspaceId' = :workspaceId", { workspaceId })
        .orderBy("o.created_at")
        .addOrderBy("o.id")
        .getRawMany<PublicApiOutboxState>()

/** The `deal_won` envelopes published on the event bus for one workspace (the automations consumer reacts to them). */
export const apiDealWon = async (
    manager: EntityManager,
    workspaceId: string,
): Promise<Array<Readonly<Record<string, unknown>>>> => {
    const rows = await manager
        .createQueryBuilder()
        .select("q.message", "message")
        .from("pgmq.q_deal_won__automations", "q")
        .where("q.message->'payload'->>'workspaceId' = :workspaceId", { workspaceId })
        .orderBy("q.msg_id")
        .getRawMany<{ readonly message: Readonly<Record<string, unknown>> }>()
    return rows.map((row) => row.message)
}

/** Inbox receipts of public API and manual inbound inputs in this workspace. */
export const apiInbox = (manager: EntityManager, workspaceId: string): Promise<Array<PublicApiInboxState>> => {
    const keys = manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.workspace_id::text || ':' || e.dedupe_key")
        .where("e.workspace_id = :workspaceId::uuid")
        .getQuery()
    return manager
        .createQueryBuilder(InboxEntity, "i")
        .select("i.source", "source")
        .addSelect("i.delivery_id", "delivery_id")
        .where(`starts_with(i.delivery_id, (:workspaceId::uuid)::text || ':') OR i.delivery_id IN (${keys})`, {
            workspaceId,
        })
        .orderBy("i.source")
        .addOrderBy("i.delivery_id")
        .getRawMany<PublicApiInboxState>()
}

/** Evidence remains exactly once across queue delivery identities. */
export const apiEvents = (manager: EntityManager, workspaceId: string): Promise<Array<PublicApiEventState>> =>
    manager
        .createQueryBuilder(EventEntity, "e")
        .select("e.kind", "kind")
        .addSelect("e.actor", "actor")
        .addSelect("e.summary", "summary")
        .addSelect("e.evidence", "evidence")
        .addSelect("e.lead_id", "lead_id")
        .where("e.workspace_id = :workspaceId", { workspaceId })
        .orderBy("e.created_at")
        .addOrderBy("e.id")
        .getRawMany<PublicApiEventState>()

/** Removes only the messages and publications created by one isolated workspace. */
export const cleanApiPublications = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("payload->>'workspaceId' = :workspaceId", { workspaceId })
        .execute()
}

/** Removes only the terminal receipt of this proof's original delivery identity. */
export const cleanApiFailedReceipt = async (manager: EntityManager, deliveryId: string): Promise<void> => {
    await manager.delete(InboxEntity, { source: "public_api.failed", deliveryId })
}

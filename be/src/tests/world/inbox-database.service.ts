import type { EntityManager } from "typeorm"
import { AgentEntity } from "@modules/domain/agents"
import { eventsEntities } from "@modules/domain/events"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { mcpCallLogEntities } from "@modules/domain/mcp-call-log"
import { mcpConnectorsEntities } from "@modules/domain/mcp-connectors"
import { messagesEntities } from "@modules/domain/messages"
import { inboxEntities } from "@modules/platform/inbox"
import { sql } from "@modules/platform/database"

const [InboxEntity] = inboxEntities

const [EventEntity] = eventsEntities
const [InboundEventEntity] = inboundEventsEntities
const [McpCallLogEntity] = mcpCallLogEntities
const [McpConnectorEntity] = mcpConnectorsEntities
const [MessageEntity] = messagesEntities

/** The most rows one proof read takes; the proofs seed far fewer. */
const PROOF_ROWS_MAX = 1000

/** Makes the evidence insert fail inside the real transaction, after the claim and hold write. */
const FAIL_TRANSACTION = sql`SELECT 1 / 0`

/** One durable claim of an inbox. */
export interface InboxClaimRow {
    /** The delivery id the claim is keyed under. */
    readonly delivery_id: string
}

/** The durable input behind an inbox claim. */
export interface InboundInputRow {
    /** The inbound event id. */
    readonly id: string
    /** The provider event id. */
    readonly event_id: string | null
}

/** One evidence line of a hold. */
export interface HoldEvidenceRow {
    /** The evidence text. */
    readonly evidence: string | null
}

/** One card line of an operation. */
export interface NoteCardRow {
    /** The message id. */
    readonly id: string
}

/** One audit line of a gateway call. */
export interface McpCallRow {
    /** The tool called. */
    readonly tool: string
    /** How the call ended. */
    readonly outcome: string
}

/** The stored credential columns of one connector, as the database holds them. */
export interface StoredCredentialRow {
    /** Whether the connector holds a credential. */
    readonly credential_state: string
    /** The sealed credential. */
    readonly credential_sealed: string | null
    /** The member who set it. */
    readonly credential_set_by: string | null
}

/** The durable claim for one operation. */
export const inboxClaims = async (
    manager: EntityManager,
    source: string,
    deliveryId: string,
): Promise<Array<InboxClaimRow>> => {
    const rows = await manager.find(InboxEntity, { where: { source, deliveryId }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ delivery_id: row.deliveryId }))
}

/** Removes exactly the scenario's claim. */
export const cleanInboxClaim = async (manager: EntityManager, source: string, deliveryId: string): Promise<void> => {
    await manager.delete(InboxEntity, { source, deliveryId })
}

/** Removes the suite's gateway receipts' inbox claims before the workspace is removed. */
export const cleanGatewayClaims = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager
        .createQueryBuilder(InboxEntity, "t")
        .delete()
        .where("source = 'mcp.gateway' AND starts_with(delivery_id, :workspaceId::text || ':')", { workspaceId })
        .execute()
}

/** Removes the receipts owned by a workspace's API or manual inputs before their domain rows disappear. */
export const cleanApiInbox = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    const keys = manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.workspace_id::text || ':' || e.dedupe_key")
        .where("e.workspace_id = :workspaceId::uuid")
        .getQuery()
    await manager
        .createQueryBuilder(InboxEntity, "t")
        .delete()
        .where(`starts_with(delivery_id, (:workspaceId::uuid)::text || ':') OR delivery_id IN (${keys})`, {
            workspaceId,
        })
        .execute()
}

/** The durable input behind an inbox claim. */
export const inboundInput = async (
    manager: EntityManager,
    workspaceId: string,
    dedupeKey: string,
): Promise<Array<InboundInputRow>> => {
    const rows = await manager.find(InboundEventEntity, { where: { workspaceId, dedupeKey }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ id: row.id, event_id: row.eventId }))
}

/** The hold's evidence lines, including duplicates. */
export const holdEvidence = async (
    manager: EntityManager,
    workspaceId: string,
    workItemId: string,
): Promise<Array<HoldEvidenceRow>> => {
    const rows = await manager.find(EventEntity, {
        where: { workspaceId, workItemId, kind: "work.held" },
        take: PROOF_ROWS_MAX,
    })
    return rows.map((row) => ({ evidence: row.evidence }))
}

/** The operation's card lines. */
export const noteCards = (manager: EntityManager, workspaceId: string, title: string): Promise<Array<NoteCardRow>> =>
    manager
        .createQueryBuilder(MessageEntity, "m")
        .select("m.id", "id")
        .where("m.workspace_id = :workspaceId AND m.card ->> 'title' = :title", { workspaceId, title })
        .getRawMany<NoteCardRow>()

/** Fails the surrounding transaction with a database error, after the work before it was written. */
export const failTransaction = async (manager: EntityManager): Promise<void> => {
    await manager.query(FAIL_TRANSACTION)
}

/** The audit lines of an agent's gateway calls. */
export const mcpCallsOfAgent = async (manager: EntityManager, agentId: string): Promise<Array<McpCallRow>> => {
    const rows = await manager.find(McpCallLogEntity, { where: { agentId }, take: 10 })
    return rows.map((row) => ({ tool: row.tool, outcome: row.outcome }))
}

/** Deletes one agent; its keys go with it. */
export const deleteAgent = async (manager: EntityManager, agentId: string): Promise<void> => {
    await manager.delete(AgentEntity, { id: agentId })
}

/** The stored credential columns of one connector. */
export const storedCredentialOf = async (
    manager: EntityManager,
    workspaceId: string,
    key: string,
): Promise<Array<StoredCredentialRow>> => {
    const rows = await manager.find(McpConnectorEntity, { where: { workspaceId, key }, take: 1 })
    return rows.map((row) => ({
        credential_state: row.credentialState,
        credential_sealed: row.credentialSealed,
        credential_set_by: row.credentialSetBy,
    }))
}

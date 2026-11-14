import type { EntityManager } from "typeorm"
import { agentsEntities } from "@modules/domain/agents"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { toolCallLogEntities } from "@modules/domain/tool-call-log"
import { teamChatEntities } from "@modules/domain/team-chat"
import { inboxEntities } from "@modules/platform/inbox"

const [AgentEntity] = agentsEntities

const [InboxEntity] = inboxEntities

const [InboundEventEntity] = inboundEventsEntities
const [ToolCallLogEntity] = toolCallLogEntities
const [, , ChatRoomMessageEntity] = teamChatEntities

/** The most rows one proof read takes; the proofs seed far fewer. */
const PROOF_ROWS_MAX = 1000

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

/** One team-chat line an agent said under a client id. */
export interface NoteLineRow {
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

/** The durable claim for one operation. */
export const inboxClaims = async (
    manager: EntityManager,
    source: string,
    deliveryId: string,
): Promise<Array<InboxClaimRow>> => {
    const rows = await manager.find(InboxEntity, { where: { source, deliveryId }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ delivery_id: row.deliveryId }))
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

/** The team-chat lines of the workspace written under one client id (the key of a line said once). */
export const noteLines = async (
    manager: EntityManager,
    workspaceId: string,
    clientId: string,
): Promise<Array<NoteLineRow>> => {
    const rows = await manager.find(ChatRoomMessageEntity, { where: { workspaceId, clientId }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ id: row.id }))
}

/** The audit lines of an agent's gateway calls. */
export const mcpCallsOfAgent = async (manager: EntityManager, agentId: string): Promise<Array<McpCallRow>> => {
    const rows = await manager.find(ToolCallLogEntity, { where: { agentId }, take: 10 })
    return rows.map((row) => ({ tool: row.tool, outcome: row.outcome }))
}

/** Deletes one agent; its keys go with it. */
export const deleteAgent = async (manager: EntityManager, agentId: string): Promise<void> => {
    await manager.delete(AgentEntity, { id: agentId })
}

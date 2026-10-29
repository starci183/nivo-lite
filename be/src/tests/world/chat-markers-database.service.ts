import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { agentMessagesEntities } from "@modules/domain/agent-messages"
import { chatMarkersEntities } from "@modules/domain/chat-markers"
import { messagesEntities } from "@modules/domain/messages"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { sql } from "@modules/platform/database"

const [AgentMessageEntity] = agentMessagesEntities
const [ChatMarkerEntity] = chatMarkersEntities
const [MessageEntity] = messagesEntities

/** The most marker or message rows one chat-markers proof arranges. */
const PROOF_ROWS_MAX = 50

/** The receipt table is protected by RLS and grants no browser or anonymous CRUD access. */
const CHAT_MARKER_PRIVILEGES = sql`
    SELECT c.relrowsecurity AS rls,
           has_table_privilege('app_be', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS backend,
           has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anonymous,
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS browser
    FROM pg_class c WHERE c.oid = 'public.chat_markers'::regclass`
/** What the backend role, the browser roles and RLS are granted on the receipt table. */
export interface ChatMarkerPrivilegeRow {
    /** Whether row-level security is enabled. */
    readonly rls: boolean
    /** Whether the backend role holds full CRUD. */
    readonly backend: boolean
    /** Whether the anonymous role holds any CRUD. */
    readonly anonymous: boolean
    /** Whether the signed-in browser role holds any CRUD. */
    readonly browser: boolean
}

/** One preference row as the database role sees it. */
export interface ChatMarkerStateRow {
    /** The member the preference belongs to. */
    readonly user_id: string
    /** The room key, or empty for a conversation target. */
    readonly room: string | null
    /** The conversation, or null for a room target. */
    readonly conversation_id: string | null
    /** Whether the target is muted. */
    readonly muted: boolean
}

/** The delivery and read cursor of one marker. */
export interface ChatMarkerCursorRow {
    /** The newest delivered message id. */
    readonly delivered_message_id: string | null
    /** The newest read message id. */
    readonly read_message_id: string | null
}

/** A stored message and the account that authored it. */
export interface ChatMessageActorRow {
    /** The message id. */
    readonly id: string
    /** The proven author, or null for an external customer. */
    readonly author_user_id: string | null
}

/** Reads the grants and RLS flag of the receipt table. */
export const chatMarkerPrivileges = (manager: EntityManager): Promise<Array<ChatMarkerPrivilegeRow>> =>
    manager.query<Array<ChatMarkerPrivilegeRow>>(CHAT_MARKER_PRIVILEGES)

/** Reads the preferences of one workspace that the manager's role may see. */
export const readChatMarkerStates = async (
    manager: EntityManager,
    workspaceId: string,
): Promise<Array<ChatMarkerStateRow>> => {
    const rows = await manager.find(ChatMarkerEntity, {
        where: { workspaceId },
        order: { userId: "ASC", targetKey: "ASC" },
        take: PROOF_ROWS_MAX,
    })
    return rows.map((row) => ({
        user_id: row.userId,
        room: row.room,
        conversation_id: row.conversationId,
        muted: row.muted,
    }))
}

/** Un-mutes a member's preference under the RLS update policy. */
export const unmuteChatMarkerState = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
): Promise<void> => {
    await manager.update(ChatMarkerEntity, { workspaceId, userId }, { muted: false })
}

/** Deletes a member's preference under the RLS delete policy. */
export const deleteChatMarkerState = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
): Promise<void> => {
    await manager.delete(ChatMarkerEntity, { workspaceId, userId })
}

/** Reads the cursors of one target key ('' for the room, the conversation id otherwise). */
export const chatMarkerCursor = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    targetKey: string,
): Promise<Array<ChatMarkerCursorRow>> => {
    const rows = await manager.find(ChatMarkerEntity, { where: { workspaceId, userId, targetKey }, take: 1 })
    return rows.map((row) => ({ delivered_message_id: row.deliveredMessageId, read_message_id: row.readMessageId }))
}

/** Reads the stable author ids stored for both team and conversation messages. */
export const chatMessageActors = async (
    manager: EntityManager,
    messageIds: ReadonlyArray<string>,
): Promise<Array<ChatMessageActorRow>> => {
    const ids = In([...messageIds])
    const select = { id: true, authorUserId: true } as const
    const team = await manager.find(MessageEntity, { select, where: { id: ids }, take: PROOF_ROWS_MAX })
    const agent = await manager.find(AgentMessageEntity, { select, where: { id: ids }, take: PROOF_ROWS_MAX })
    return [...team, ...agent]
        .map((row) => ({ id: row.id, author_user_id: row.authorUserId }))
        .toSorted((left, right) => left.id.localeCompare(right.id))
}

/** Updates an account's current reader label without touching historical message authors. */
export const renameChatReader = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    displayName: string,
): Promise<void> => {
    await manager.update(WorkspaceMemberEntity, { workspaceId, userId }, { displayName })
}

/** Disables a reader after they acknowledged a message. */
export const disableChatReader = async (manager: EntityManager, workspaceId: string, userId: string): Promise<void> => {
    await manager.update(WorkspaceMemberEntity, { workspaceId, userId }, { status: "disabled" })
}

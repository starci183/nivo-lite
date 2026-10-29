import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentEntity } from "@modules/domain/agents"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { messagesEntities } from "@modules/domain/messages"
import { officeRoomsEntities } from "@modules/domain/office-rooms"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { chatMarkersEntities } from "@modules/domain/chat-markers"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"

const [ChatMarkerEntity] = chatMarkersEntities
const [MessageEntity] = messagesEntities
const [OfficeRoomEntity, , , OfficeRoomReadEntity] = officeRoomsEntities

/** Fresh identities for one isolated receipt and preference proof. */
export interface ChatMarkersIdentity {
    /** The workspace whose members exchange messages. */
    readonly workspaceId: string
    /** A separate tenant used to prove conversation fencing. */
    readonly foreignWorkspaceId: string
    /** The sending account. */
    readonly ownerId: string
    /** Four active readers followed by one disabled reader. */
    readonly readerIds: readonly [string, string, string, string, string]
    /** An account with no membership in the selected workspace. */
    readonly outsiderId: string
    /** The foreign workspace owner. */
    readonly foreignOwnerId: string
    /** One agent in each workspace. */
    readonly agentIds: readonly [string, string]
    /** Test, customer and foreign conversations. */
    readonly conversationIds: readonly [string, string, string]
}

/** Allocates identifiers that never overlap with another integration fixture. */
export const chatMarkersIdentity = (next: () => string): ChatMarkersIdentity => ({
    workspaceId: next(),
    foreignWorkspaceId: next(),
    ownerId: next(),
    readerIds: [next(), next(), next(), next(), next()],
    outsiderId: next(),
    foreignOwnerId: next(),
    agentIds: [next(), next()],
    conversationIds: [next(), next(), next()],
})

/** A persisted message whose actor may be absent for historical messages. */
export interface ChatMarkerLine {
    /** The persisted id acknowledged by clients. */
    readonly id: string
    /** The proven account that authored the message, or null for a legacy line. */
    readonly authorId: string | null
    /** A deliberately independent display name. */
    readonly authorName: string
    /** The creation instant used to prove cursor ordering. */
    readonly at: string
}

/** Persists the two tenants, members, rooms and conversation kinds of a proof. */
export const persistChatMarkers = (manager: EntityManager, identity: ChatMarkersIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        const users = [identity.ownerId, ...identity.readerIds, identity.outsiderId, identity.foreignOwnerId]
        await eachInOrder(users, async (id) => {
            await tx.insert("auth.users", { id, raw_user_meta_data: {} })
        })
        await tx.insert(WorkspaceEntity, {
            id: identity.workspaceId,
            ownerId: identity.ownerId,
            name: "Chat markers proof",
        })
        await tx.insert(WorkspaceEntity, {
            id: identity.foreignWorkspaceId,
            ownerId: identity.foreignOwnerId,
            name: "Foreign chat markers proof",
        })
        await tx.update(
            WorkspaceMemberEntity,
            { workspaceId: identity.workspaceId, userId: identity.ownerId },
            { displayName: "Shared name" },
        )
        await eachInOrder(identity.readerIds, async (userId, index) => {
            await tx.insert(WorkspaceMemberEntity, {
                workspaceId: identity.workspaceId,
                userId: userId,
                role: "staff",
                displayName: index === 0 ? "Shared name" : `Reader ${index + 1}`,
                status: index === 4 ? "disabled" : "active",
            })
        })
        await eachInOrder(["sales", "marketing"], async (key) => {
            await tx.insert(OfficeRoomEntity, {
                workspaceId: identity.workspaceId,
                key,
                name: key,
            })
        })
        await eachInOrder(identity.agentIds, async (id, index) => {
            await tx.insert(AgentEntity, {
                id,
                workspaceId: index === 0 ? identity.workspaceId : identity.foreignWorkspaceId,
                module: "chatbot",
                name: "Chat marker agent",
                handle: `marker-agent-${id}`,
                role: "Chat receipt proof",
                instructions: "Exercise persisted chat markers.",
                status: "active",
            })
        })
        await eachInOrder(identity.conversationIds, async (id, index) => {
            await tx.insert(AgentConversationEntity, {
                id,
                workspaceId: index === 2 ? identity.foreignWorkspaceId : identity.workspaceId,
                agentId: index === 2 ? identity.agentIds[1] : identity.agentIds[0],
                kind: index === 0 ? "test" : "customer",
            })
        })
    })

/** Appends a room message without invoking any delivery or unread computation. */
export const persistOfficeMarkerLine = async (
    manager: EntityManager,
    identity: ChatMarkersIdentity,
    room: string | null,
    line: ChatMarkerLine,
): Promise<void> => {
    await manager.insert(MessageEntity, {
        id: line.id,
        workspaceId: identity.workspaceId,
        authorKind: "human",
        authorUserId: line.authorId,
        authorName: line.authorName,
        body: "Persisted room receipt proof",
        room,
        createdAt: line.at,
    })
}

/** Appends an authored conversation message; external customer messages have no account actor. */
export const persistConversationMarkerLine = async (
    manager: EntityManager,
    identity: ChatMarkersIdentity,
    conversationId: string,
    line: ChatMarkerLine,
): Promise<void> => {
    await manager.insert(AgentMessageEntity, {
        id: line.id,
        workspaceId:
            conversationId === identity.conversationIds[2] ? identity.foreignWorkspaceId : identity.workspaceId,
        conversationId: conversationId,
        role: "agent",
        authorKind: "human",
        authorUserId: line.authorId,
        authorName: line.authorName,
        body: "Persisted conversation receipt proof",
        createdAt: line.at,
    })
}

/** Writes a muted preference, as whichever role the manager runs under. */
export const insertChatMarkerState = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    room: string,
    conversationId: string | null,
): Promise<void> => {
    await manager.insert(ChatMarkerEntity, { workspaceId, userId, room, conversationId, muted: true })
}

/** Records an existing room read marker, which must count as seen without a new receipt write. */
export const insertLegacyRoomRead = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    room: string,
    at: string,
): Promise<void> => {
    await manager.insert(OfficeRoomReadEntity, { workspaceId, userId, room, lastReadAt: at })
}

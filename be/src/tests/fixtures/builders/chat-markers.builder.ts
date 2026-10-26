import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"

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
            await tx.insert("auth.users", { id })
        })
        await tx.insert("public.workspaces", {
            id: identity.workspaceId,
            owner_id: identity.ownerId,
            name: "Chat markers proof",
        })
        await tx.insert("public.workspaces", {
            id: identity.foreignWorkspaceId,
            owner_id: identity.foreignOwnerId,
            name: "Foreign chat markers proof",
        })
        await tx.update(
            "public.workspace_members",
            { workspace_id: identity.workspaceId, user_id: identity.ownerId },
            { display_name: "Shared name" },
        )
        await eachInOrder(identity.readerIds, async (userId, index) => {
            await tx.insert("public.workspace_members", {
                workspace_id: identity.workspaceId,
                user_id: userId,
                role: "staff",
                display_name: index === 0 ? "Shared name" : `Reader ${index + 1}`,
                status: index === 4 ? "disabled" : "active",
            })
        })
        await eachInOrder(["sales", "marketing"], async (key) => {
            await tx.insert("public.office_rooms", {
                workspace_id: identity.workspaceId,
                key,
                name: key,
            })
        })
        await eachInOrder(identity.agentIds, async (id, index) => {
            await tx.insert("public.agents", {
                id,
                workspace_id: index === 0 ? identity.workspaceId : identity.foreignWorkspaceId,
                module: "chatbot",
                name: "Chat marker agent",
                handle: `marker-agent-${id}`,
                role: "Chat receipt proof",
                instructions: "Exercise persisted chat markers.",
                status: "active",
            })
        })
        await eachInOrder(identity.conversationIds, async (id, index) => {
            await tx.insert("public.agent_conversations", {
                id,
                workspace_id: index === 2 ? identity.foreignWorkspaceId : identity.workspaceId,
                agent_id: index === 2 ? identity.agentIds[1] : identity.agentIds[0],
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
    await manager.insert("public.messages", {
        id: line.id,
        workspace_id: identity.workspaceId,
        author_kind: "human",
        author_user_id: line.authorId,
        author_name: line.authorName,
        body: "Persisted room receipt proof",
        room,
        created_at: line.at,
    })
}

/** Appends an authored conversation message; external customer messages have no account actor. */
export const persistConversationMarkerLine = async (
    manager: EntityManager,
    identity: ChatMarkersIdentity,
    conversationId: string,
    line: ChatMarkerLine,
): Promise<void> => {
    await manager.insert("public.agent_messages", {
        id: line.id,
        workspace_id:
            conversationId === identity.conversationIds[2] ? identity.foreignWorkspaceId : identity.workspaceId,
        conversation_id: conversationId,
        role: "agent",
        author_kind: "human",
        author_user_id: line.authorId,
        author_name: line.authorName,
        body: "Persisted conversation receipt proof",
        created_at: line.at,
    })
}

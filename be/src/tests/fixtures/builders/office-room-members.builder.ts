import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"

/** The accounts, memberships and room seats of one isolated room-list proof. */
export interface OfficeRoomMembersIdentity {
    /** The workspace whose group previews are read. */
    readonly workspaceId: string
    /** A workspace whose people and agents must never enter those previews. */
    readonly foreignWorkspaceId: string
    /** The caller, automatically admitted as the workspace owner. */
    readonly ownerId: string
    /** An active manager who joins departments without active person seats. */
    readonly managerId: string
    /** Active staff without an account cannot enter the room membership. */
    readonly unlinkedStaffId: string
    /** Four active people, followed by a disabled manager. */
    readonly userIds: readonly [string, string, string, string, string]
    /** The corresponding membership ids; the first also identifies an agent to prove kind ties. */
    readonly memberIds: readonly [string, string, string, string, string]
    /** Three active agents, followed by a paused agent who remains a group member. */
    readonly agentIds: readonly [string, string, string, string]
    /** The other workspace's owner. */
    readonly foreignUserId: string
    /** The other workspace's agent. */
    readonly foreignAgentId: string
    /** A populated room, an empty room, the foreign room, and a room with only a disabled person seat. */
    readonly roomIds: readonly [string, string, string, string]
    /** Four preview seats, two overflow seats, a disabled person, a paused agent, and two foreign seats. */
    readonly seatIds: readonly [string, string, string, string, string, string, string, string, string, string]
}

/** Allocates fresh proof identities, including a deliberate person/agent identity tie across their separate tables. */
export const officeRoomMembersIdentity = (next: () => string): OfficeRoomMembersIdentity => {
    const memberIds = [next(), next(), next(), next(), next()] as const
    return {
        workspaceId: next(),
        foreignWorkspaceId: next(),
        ownerId: next(),
        managerId: next(),
        unlinkedStaffId: next(),
        userIds: [next(), next(), next(), next(), next()],
        memberIds,
        agentIds: [memberIds[0], next(), next(), next()],
        foreignUserId: next(),
        foreignAgentId: next(),
        roomIds: [next(), next(), next(), next()],
        seatIds: [next(), next(), next(), next(), next(), next(), next(), next(), next(), next()],
    }
}

/** The provider URL already held in Auth metadata, carried through without constructing a storage reference. */
export const OFFICE_MEMBER_AVATAR = "https://images.example.test/provider-person.png"

const FIRST_JOIN = "2026-01-01T00:00:00+00:00"
const SECOND_JOIN = "2026-01-01T00:01:00+00:00"
const THIRD_JOIN = "2026-01-01T00:02:00+00:00"
const LATER_JOIN = "2026-01-02T00:00:00+00:00"
const MANAGER_JOIN = "2026-01-03T00:00:00+00:00"

/** Valid, malformed and unsafe provider values exercise the server's HTTPS-only projection. */
const PROFILE_METADATA = [
    { avatar_url: OFFICE_MEMBER_AVATAR, full_name: "Old profile name" },
    { avatar_url: 42 },
    { avatar_url: "http://images.example.test/person.png" },
    { avatar_url: "javascript:alert(1)" },
    {},
] as const

/** Persists provider metadata and membership names that deliberately differ from the provider's old profile name. */
const persistPeople = async (tx: EntityManager, identity: OfficeRoomMembersIdentity): Promise<void> => {
    await tx.insert("auth.users", { id: identity.ownerId })
    await tx.insert("auth.users", { id: identity.managerId })
    await tx.insert("auth.users", {
        id: identity.foreignUserId,
        raw_user_meta_data: { avatar_url: OFFICE_MEMBER_AVATAR },
    })
    await eachInOrder(identity.userIds, async (id, index) => {
        await tx.insert("auth.users", { id, raw_user_meta_data: PROFILE_METADATA[index] })
    })
    await tx.insert("public.workspaces", {
        id: identity.workspaceId,
        owner_id: identity.ownerId,
        name: "Room members proof",
    })
    await tx.insert("public.workspaces", {
        id: identity.foreignWorkspaceId,
        owner_id: identity.foreignUserId,
        name: "Foreign room members proof",
    })
    await tx.update(
        "public.workspace_members",
        { workspace_id: identity.workspaceId, user_id: identity.ownerId },
        {
            display_name: "Owner",
            created_at: LATER_JOIN,
        },
    )
    await eachInOrder(identity.userIds, async (userId, index) => {
        const times = [FIRST_JOIN, SECOND_JOIN, THIRD_JOIN, LATER_JOIN, FIRST_JOIN]
        await tx.insert("public.workspace_members", {
            id: identity.memberIds[index],
            workspace_id: identity.workspaceId,
            user_id: userId,
            role: index === 4 ? "manager" : "staff",
            display_name: `Person ${index + 1}`,
            status: index === 4 ? "disabled" : "active",
            created_at: times[index],
        })
    })
}

/** Unseated managers are fallback members; unlinked staff remain outside chat membership. */
const persistFallbackPeople = async (tx: EntityManager, identity: OfficeRoomMembersIdentity): Promise<void> => {
    await tx.insert("public.workspace_members", {
        workspace_id: identity.workspaceId,
        user_id: identity.managerId,
        role: "manager",
        display_name: "Manager",
        status: "active",
        created_at: MANAGER_JOIN,
    })
    await tx.insert("public.staff", {
        id: identity.unlinkedStaffId,
        workspace_id: identity.workspaceId,
        name: "Staff without an account",
        active: true,
    })
}

/** The picture an owner gave the first agent, stored on the agent itself. */
export const OFFICE_AGENT_AVATAR = "https://images.example.test/agent-one.png"

/** Persists active and paused agents in both workspaces; only the first agent has a picture of its own. */
const persistAgents = async (tx: EntityManager, identity: OfficeRoomMembersIdentity): Promise<void> => {
    await eachInOrder([...identity.agentIds, identity.foreignAgentId], async (id, index) => {
        await tx.insert("public.agents", {
            id,
            workspace_id: index === 4 ? identity.foreignWorkspaceId : identity.workspaceId,
            module: "sales",
            name: index === 4 ? "Foreign agent" : `Agent ${index + 1}`,
            handle: `member-proof-${id}`,
            role: "Room preview proof",
            instructions: "Persisted room preview proof.",
            status: index === 3 ? "paused" : "active",
            avatar_url: index === 0 ? OFFICE_AGENT_AVATAR : null,
            created_at: index === 0 ? FIRST_JOIN : LATER_JOIN,
        })
    })
}

/** Persists reversed insertion order with tied join times, overflow members, a disabled person and malformed foreign seats. */
const persistSeats = async (tx: EntityManager, identity: OfficeRoomMembersIdentity): Promise<void> => {
    const people = identity.userIds
    const agents = identity.agentIds
    const seated = [
        { user_id: people[0] },
        { agent_id: agents[0] },
        { user_id: people[1] },
        { user_id: people[2] },
        { user_id: people[3] },
        { agent_id: agents[1] },
        { user_id: people[4] },
        { agent_id: agents[3] },
        { user_id: identity.foreignUserId },
        { agent_id: identity.foreignAgentId },
    ]
    const rows = seated.map((seat, index) => ({
        id: identity.seatIds[index],
        room_id: identity.roomIds[0],
        created_at: index < 4 || index >= 6 ? FIRST_JOIN : LATER_JOIN,
        ...seat,
    }))
    await eachInOrder([...rows].reverse(), async (row) => {
        await tx.insert("public.office_rooms_members", row)
    })
    await tx.insert("public.office_rooms_members", { room_id: identity.roomIds[2], user_id: identity.foreignUserId })
    await tx.insert("public.office_rooms_members", { room_id: identity.roomIds[2], agent_id: identity.foreignAgentId })
    await tx.insert("public.office_rooms_members", { room_id: identity.roomIds[3], user_id: identity.userIds[4] })
}

/** Persists three groups and a foreign workspace, each under fresh ids owned by this proof. */
export const persistOfficeRoomMembers = (manager: EntityManager, identity: OfficeRoomMembersIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await persistPeople(tx, identity)
        await persistFallbackPeople(tx, identity)
        await persistAgents(tx, identity)
        await tx.insert("public.office_rooms", {
            id: identity.roomIds[0],
            workspace_id: identity.workspaceId,
            key: "sales",
            name: "Sales",
            position: 1,
        })
        await tx.insert("public.office_rooms", {
            id: identity.roomIds[1],
            workspace_id: identity.workspaceId,
            key: "marketing",
            name: "Empty",
            position: 2,
        })
        await tx.insert("public.office_rooms", {
            id: identity.roomIds[2],
            workspace_id: identity.foreignWorkspaceId,
            key: "sales",
            name: "Foreign sales",
            position: 1,
        })
        await tx.insert("public.office_rooms", {
            id: identity.roomIds[3],
            workspace_id: identity.workspaceId,
            key: "care",
            name: "Disabled person seat",
            position: 3,
        })
        await persistSeats(tx, identity)
    })

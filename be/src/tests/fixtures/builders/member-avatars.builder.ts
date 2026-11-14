import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"
import { agentsEntities } from "@modules/domain/agents"
import { workspacesEntities } from "@modules/domain/workspaces"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"

const [AgentEntity] = agentsEntities

const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

/** Narrows an indexed fixture id that the persisted story always provides. */
const required = <T>(value: T | undefined): T => {
    assert(value !== undefined)
    return value
}

/** The accounts, memberships and agents of one isolated avatar proof. */
export interface MemberAvatarsIdentity {
    /** The workspace whose member pictures are read. */
    readonly workspaceId: string
    /** A workspace whose people and agents must never enter those previews. */
    readonly foreignWorkspaceId: string
    /** The caller, automatically admitted as the workspace owner. */
    readonly ownerId: string
    /** Four active people, followed by a disabled manager. */
    readonly userIds: readonly [string, string, string, string, string]
    /** The corresponding membership ids; the first also identifies an agent to prove kind ties. */
    readonly memberIds: readonly [string, string, string, string, string]
    /** Three active agents, followed by a paused agent. */
    readonly agentIds: readonly [string, string, string, string]
    /** The other workspace's owner. */
    readonly foreignUserId: string
    /** The other workspace's agent. */
    readonly foreignAgentId: string
}

/** Allocates fresh proof identities, including a deliberate person/agent identity tie across their separate tables. */
export const memberAvatarsIdentity = (next: () => string): MemberAvatarsIdentity => {
    const memberIds = [next(), next(), next(), next(), next()] as const
    return {
        workspaceId: next(),
        foreignWorkspaceId: next(),
        ownerId: next(),
        userIds: [next(), next(), next(), next(), next()],
        memberIds,
        agentIds: [memberIds[0], next(), next(), next()],
        foreignUserId: next(),
        foreignAgentId: next(),
    }
}

/** The provider URL already held in Auth metadata, carried through without constructing a storage reference. */
export const MEMBER_PROVIDER_AVATAR = "https://images.example.test/provider-person.png"

const FIRST_JOIN = "2026-01-01T00:00:00+00:00"
const SECOND_JOIN = "2026-01-01T00:01:00+00:00"
const THIRD_JOIN = "2026-01-01T00:02:00+00:00"
const LATER_JOIN = "2026-01-02T00:00:00+00:00"

/** Valid, malformed and unsafe provider values exercise the server's HTTPS-only projection. */
const PROFILE_METADATA = [
    { avatar_url: MEMBER_PROVIDER_AVATAR, full_name: "Old profile name" },
    { avatar_url: 42 },
    { avatar_url: "http://images.example.test/person.png" },
    { avatar_url: "javascript:alert(1)" },
    {},
] as const

/** Persists provider metadata and membership names that deliberately differ from the provider's old profile name. */
const persistPeople = async (tx: EntityManager, identity: MemberAvatarsIdentity): Promise<void> => {
    await tx.insert("auth.users", { id: identity.ownerId })
    await tx.insert("auth.users", {
        id: identity.foreignUserId,
        raw_user_meta_data: { avatar_url: MEMBER_PROVIDER_AVATAR },
    })
    await eachInOrder(identity.userIds, async (id, index) => {
        await tx.insert("auth.users", { id, raw_user_meta_data: PROFILE_METADATA[index] })
    })
    await tx.insert(WorkspaceEntity, {
        id: identity.workspaceId,
        ownerId: identity.ownerId,
        name: "Member avatars proof",
    })
    await tx.insert(WorkspaceEntity, {
        id: identity.foreignWorkspaceId,
        ownerId: identity.foreignUserId,
        name: "Foreign member avatars proof",
    })
    await tx.update(
        WorkspaceMemberEntity,
        { workspaceId: identity.workspaceId, userId: identity.ownerId },
        {
            displayName: "Owner",
            createdAt: LATER_JOIN,
        },
    )
    await eachInOrder(identity.userIds, async (userId, index) => {
        const times = [FIRST_JOIN, SECOND_JOIN, THIRD_JOIN, LATER_JOIN, FIRST_JOIN]
        await tx.insert(WorkspaceMemberEntity, {
            id: required(identity.memberIds[index]),
            workspaceId: identity.workspaceId,
            userId: userId,
            role: index === 4 ? "manager" : "staff",
            displayName: `Person ${index + 1}`,
            status: index === 4 ? "disabled" : "active",
            createdAt: required(times[index]),
        })
    })
}

/** The picture an owner gave the first agent, stored on the agent itself. */
export const MEMBER_AGENT_AVATAR = "https://images.example.test/agent-one.png"

/** Persists active and paused agents in both workspaces; only the first agent has a picture of its own. */
const persistAgents = async (tx: EntityManager, identity: MemberAvatarsIdentity): Promise<void> => {
    await eachInOrder([...identity.agentIds, identity.foreignAgentId], async (id, index) => {
        await tx.insert(AgentEntity, {
            id,
            workspaceId: index === 4 ? identity.foreignWorkspaceId : identity.workspaceId,
            module: "sales",
            name: index === 4 ? "Foreign agent" : `Agent ${index + 1}`,
            handle: `member-proof-${id}`,
            role: "Avatar proof",
            instructions: "Persisted avatar proof.",
            status: index === 3 ? "paused" : "active",
            avatarUrl: index === 0 ? MEMBER_AGENT_AVATAR : null,
            createdAt: index === 0 ? FIRST_JOIN : LATER_JOIN,
        })
    })
}

/** Persists two workspaces with their people and agents, each under fresh ids owned by this proof. */
export const persistMemberAvatars = (manager: EntityManager, identity: MemberAvatarsIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await persistPeople(tx, identity)
        await persistAgents(tx, identity)
    })

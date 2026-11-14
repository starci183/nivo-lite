import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { teamChatEntities } from "@modules/domain/team-chat"
import { agentsEntities } from "@modules/domain/agents"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"

const [WorkspaceEntity] = workspacesEntities
const ChatRoomEntity: (typeof teamChatEntities)[0] = teamChatEntities[0]
const ChatRoomMemberEntity: (typeof teamChatEntities)[1] = teamChatEntities[1]
const ChatRoomMessageEntity: (typeof teamChatEntities)[2] = teamChatEntities[2]
type ChatRoomEntity = InstanceType<typeof ChatRoomEntity>
type ChatRoomMemberEntity = InstanceType<typeof ChatRoomMemberEntity>
type ChatRoomMessageEntity = InstanceType<typeof ChatRoomMessageEntity>
const [AgentEntity] = agentsEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

/** The people of one team chat proof: an owner, three staff and a person of another workspace. */
export interface TeamChatIdentity {
    /** The workspace. */
    readonly workspaceId: string
    /** The owner of the workspace. */
    readonly ownerId: string
    /** Three staff seats. */
    readonly staffIds: readonly [string, string, string]
    /** An active agent of the workspace. */
    readonly agentId: string
    /** An account that sits in a different workspace. */
    readonly outsiderId: string
    /** The workspace of the outsider. */
    readonly foreignWorkspaceId: string
}

/** Fresh ids for a proof. */
export const teamChatIdentity = (id: () => string): TeamChatIdentity => ({
    workspaceId: id(),
    ownerId: id(),
    staffIds: [id(), id(), id()],
    agentId: id(),
    outsiderId: id(),
    foreignWorkspaceId: id(),
})

/** Writes the accounts and the two workspaces (the owner seat is the database's), then the staff seats. */
export const persistTeamChat = (manager: EntityManager, identity: TeamChatIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await eachInOrder([identity.ownerId, ...identity.staffIds, identity.outsiderId], (userId) =>
            tx.insert("auth.users", { id: userId, raw_user_meta_data: {} }),
        )
        await tx.insert(WorkspaceEntity, {
            id: identity.workspaceId,
            ownerId: identity.ownerId,
            name: "Team chat proof",
        })
        await tx.insert(WorkspaceEntity, {
            id: identity.foreignWorkspaceId,
            ownerId: identity.outsiderId,
            name: "Foreign team chat proof",
        })
        await tx.update(
            WorkspaceMemberEntity,
            { workspaceId: identity.workspaceId, userId: identity.ownerId },
            { displayName: "Owner" },
        )
        await tx.insert(AgentEntity, {
            id: identity.agentId,
            workspaceId: identity.workspaceId,
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "",
            knowledge: "",
            greeting: "",
            approvalRule: "",
            status: "active",
        })
        await tx.insert(
            WorkspaceMemberEntity,
            identity.staffIds.map((userId, index) => ({
                workspaceId: identity.workspaceId,
                userId,
                role: "staff" as const,
                displayName: `Staff ${String(index + 1)}`,
                status: "active" as const,
            })),
        )
    })

/** The refusal codes of the team chat as the strings its doors answer, so a spec reads them without reaching into the capability. */
export const TEAM_CHAT_CODES = {
    notFound: "TEAM_CHAT_NOT_FOUND",
    notMember: "TEAM_CHAT_NOT_MEMBER",
    forbidden: "TEAM_CHAT_FORBIDDEN",
    directNeedsTwo: "TEAM_CHAT_DIRECT_NEEDS_TWO",
    groupNeedsName: "TEAM_CHAT_GROUP_NEEDS_NAME",
    memberUnknown: "TEAM_CHAT_MEMBER_UNKNOWN",
    alreadyMember: "TEAM_CHAT_ALREADY_MEMBER",
    notAMemberToRemove: "TEAM_CHAT_NOT_A_MEMBER_TO_REMOVE",
    lastOwner: "TEAM_CHAT_LAST_OWNER",
    bodyEmpty: "TEAM_CHAT_BODY_EMPTY",
    bodyTooLong: "TEAM_CHAT_BODY_TOO_LONG",
    tooManyMentions: "TEAM_CHAT_TOO_MANY_MENTIONS",
    tooManyFiles: "TEAM_CHAT_TOO_MANY_FILES",
    fileTooLarge: "TEAM_CHAT_FILE_TOO_LARGE",
    fileTypeNotAllowed: "TEAM_CHAT_FILE_TYPE_NOT_ALLOWED",
    storageUnavailable: "TEAM_CHAT_STORAGE_UNAVAILABLE",
} as const

/** The seat id (workspace_members.id) of an account of a workspace. */
export const seatIdOf = async (manager: EntityManager, workspaceId: string, userId: string): Promise<string> => {
    const seat = await manager.findOneOrFail(WorkspaceMemberEntity, { where: { workspaceId, userId } })
    return seat.id
}

/** One staff seat to write. */
export interface StaffSeatInput {
    /** The workspace the seat sits in. */
    readonly workspaceId: string
    /** The account of the seat. */
    readonly userId: string
    /** The name shown for the seat. */
    readonly displayName: string
}

/** Writes an account that holds an active staff seat in the workspace. */
export const persistStaffSeat = async (manager: EntityManager, seat: StaffSeatInput): Promise<void> => {
    await manager.insert("auth.users", { id: seat.userId })
    await manager.insert(WorkspaceMemberEntity, {
        workspaceId: seat.workspaceId,
        userId: seat.userId,
        role: "staff",
        displayName: seat.displayName,
        status: "active",
    })
}

/** Writes an account with no seat anywhere. */
export const persistStranger = async (manager: EntityManager, userId: string): Promise<void> => {
    await manager.insert("auth.users", { id: userId })
}

const ANA = "22222222-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")

/** A text message row of the view specs: Ana's "hello" in the room, unpinned and without files. */
export const messageOf: (overrides?: Partial<ChatRoomMessageEntity>) => ChatRoomMessageEntity =
    builder<ChatRoomMessageEntity>({
        id: "51111111-1111-4111-8111-111111111111",
        roomId: ROOM,
        workspaceId: "11111111-1111-4111-8111-111111111111",
        authorKind: "user",
        authorId: ANA,
        body: "hello",
        kind: "text",
        ref: null,
        mentions: [],
        attachments: [],
        createdAt: AT,
        editedAt: null,
        clientId: null,
        replyTo: null,
        updatedAt: AT,
    })

/** One seat of the room: a member who read up to the first moment and has not muted it. */
export const seatOf = (
    memberKind: "user" | "agent",
    memberId: string,
    role: "owner" | "member" = "member",
    muted = false,
): ChatRoomMemberEntity =>
    builder<ChatRoomMemberEntity>({
        roomId: ROOM,
        workspaceId: "11111111-1111-4111-8111-111111111111",
        memberKind,
        memberId,
        role,
        lastReadAt: AT,
        muted,
        mayPost: false,
        createdAt: AT,
        updatedAt: AT,
    })()

/** A group room named Team at position 4, opened by Ana. */
export const roomOf: (overrides?: Partial<ChatRoomEntity>) => ChatRoomEntity = builder<ChatRoomEntity>({
    id: ROOM,
    kind: "group",
    name: "Team",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    position: 4,
    directKey: null,
    purpose: "group",
    purposeModule: null,
    createdBy: ANA,
    createdAt: AT,
    updatedAt: AT,
})

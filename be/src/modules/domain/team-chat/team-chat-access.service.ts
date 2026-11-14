import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { ChatRoomEntity } from "./persistence/entities"
import type { ChatMemberRef } from "./team-chat.contracts"
import { TeamChatStoreService, type OptionalMessage, type OptionalRoom } from "./team-chat-store.service"


/** The most active seats one workspace holds that a membership check reads. */
const SEATS_MAX = 5000

@Injectable()
/**
 * Who may see and change what in the chat: a person sees the rooms they sit in and an owner of the workspace sees them all; only an
 * owner of the workspace or of a group changes its members; only people and agents of the workspace are ever named.
 */
export class TeamChatAccessService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** Whether the person owns the workspace, and so sees every room. */
    async isOwner(workspaceId: string, userId: string): Promise<boolean> {
        return (await this.seats.activeSeatOfUser(workspaceId, userId))?.role === "owner"
    }

    /** The room when the viewer sits in it or owns the workspace; null otherwise. */
    async visibleRoom(workspaceId: string, viewerId: string, roomId: string): Promise<OptionalRoom> {
        const found = await this.store.roomById(workspaceId, roomId)
        if (found === null) return null
        const seat = await this.store.memberOf(roomId, { memberKind: "user", memberId: viewerId })
        return seat !== null || (await this.isOwner(workspaceId, viewerId)) ? found : null
    }

    /** Whether the viewer may change the members of a group: an owner of the workspace or of the room. */
    async mayManage(workspaceId: string, viewerId: string, room: ChatRoomEntity): Promise<boolean> {
        if (await this.isOwner(workspaceId, viewerId)) return true
        const seat = await this.store.memberOf(room.id, { memberKind: "user", memberId: viewerId })
        return seat?.role === "owner"
    }

    /** The message when the viewer sees its room; null when the room or the message is not theirs to see. */
    async pinnable(workspaceId: string, viewerId: string, roomId: string, messageId: string): Promise<OptionalMessage> {
        if ((await this.visibleRoom(workspaceId, viewerId, roomId)) === null) return null
        return this.store.messageIn(workspaceId, roomId, messageId)
    }

    /** Whether every named member is an active person or an active agent of the workspace. */
    async allKnown(workspaceId: string, members: ReadonlyArray<ChatMemberRef>): Promise<boolean> {
        const users = members.filter((member) => member.memberKind === "user").map((member) => member.memberId)
        const agentIds = members.filter((member) => member.memberKind === "agent").map((member) => member.memberId)
        const [seated, agents] = await Promise.all([
            users.length === 0 ? [] : this.seats.activeUsers(workspaceId, SEATS_MAX),
            this.agents.activeInOrder(workspaceId, agentIds, agentIds.length),
        ])
        const active = new Set(seated.map((seat) => seat.userId))
        return users.every((user) => active.has(user)) && agents.length === new Set(agentIds).size
    }
}

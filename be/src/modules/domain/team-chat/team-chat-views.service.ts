import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import type { ChatMemberRef, MessageView, ChatRoomView } from "./team-chat.contracts"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import {
    decisionIdsOf,
    messageViewOf,
    nameKeyOf,
    refsOfMessages,
    roomViewOf,
    type MessageViewContext,
    type RoomViewContext,
} from "./team-chat-view.policy"

@Injectable()
/** Turns the rows of the chat into what a screen shows: names of people and agents, unread counts, pins, file addresses and decision states. */
export class TeamChatViewsService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly people: WorkspaceMembersReadService,
        private readonly agents: AgentDirectoryService,
        private readonly files: TeamChatFilesService,
        private readonly approvals: TeamChatApprovalsService,
    ) {}

    /** The rooms as the viewer sees them, in the order given. */
    async roomViews(
        workspaceId: string,
        viewerId: string,
        rooms: ReadonlyArray<ChatRoomEntity>,
    ): Promise<Array<ChatRoomView>> {
        if (rooms.length === 0) return []
        const members = await this.store.membersOf(rooms.map((room) => room.id))
        const context = await this.roomContextOf(workspaceId, viewerId, rooms, members)
        return rooms.map((room) =>
            roomViewOf(
                room,
                members.filter((member) => member.roomId === room.id),
                context,
            ),
        )
    }

    /** One room as the viewer sees it. */
    async roomView(workspaceId: string, viewerId: string, room: ChatRoomEntity): Promise<ChatRoomView> {
        const members = await this.store.membersOf([room.id])
        return roomViewOf(room, members, await this.roomContextOf(workspaceId, viewerId, [room], members))
    }

    /** The messages as the viewer sees them, in the order given. */
    async messageViews(
        workspaceId: string,
        messages: ReadonlyArray<ChatRoomMessageEntity>,
        viewerId: string,
    ): Promise<Array<MessageView>> {
        if (messages.length === 0) return []
        const context = await this.messageContextOf(workspaceId, messages, viewerId)
        return messages.map((message) => messageViewOf(message, context))
    }

    /** One message as the viewer sees it. */
    async viewOf(workspaceId: string, message: ChatRoomMessageEntity, viewerId: string): Promise<MessageView> {
        return messageViewOf(message, await this.messageContextOf(workspaceId, [message], viewerId))
    }

    /** The names of people and agents of the workspace, by `kind:id`; a member that left has none. */
    async namesOf(workspaceId: string, refs: ReadonlyArray<ChatMemberRef>): Promise<Map<string, string>> {
        const users = [...new Set(refs.filter((ref) => ref.memberKind === "user").map((ref) => ref.memberId))]
        const agentIds = [...new Set(refs.filter((ref) => ref.memberKind === "agent").map((ref) => ref.memberId))]
        const [people, agents] = await Promise.all([
            this.people.namesOf(workspaceId, users),
            this.agents.activeInOrder(workspaceId, agentIds, agentIds.length),
        ])
        return new Map([
            ...people.map((person) => [nameKeyOf("user", person.userId), person.displayName] as const),
            ...agents.map((agent) => [nameKeyOf("agent", agent.id), agent.name] as const),
        ])
    }

    private async roomContextOf(
        workspaceId: string,
        viewerId: string,
        rooms: ReadonlyArray<ChatRoomEntity>,
        members: ReadonlyArray<ChatRoomMemberEntity>,
    ): Promise<RoomViewContext> {
        const names = await this.namesOf(workspaceId, members)
        const unread = await this.store.unreadRows(workspaceId, viewerId, null)
        const lastIds = await this.store.lastMessageIds(
            workspaceId,
            rooms.map((room) => room.id),
        )
        const lasts = await this.messageViews(
            workspaceId,
            await this.store.messagesByIds(workspaceId, lastIds),
            viewerId,
        )
        return {
            viewerId,
            names,
            unread: new Map(unread.map((row) => [row.roomId, row])),
            lasts: new Map(lasts.map((view) => [view.roomId, view])),
        }
    }

    private async messageContextOf(
        workspaceId: string,
        messages: ReadonlyArray<ChatRoomMessageEntity>,
        viewerId: string,
    ): Promise<MessageViewContext> {
        const names = await this.namesOf(workspaceId, refsOfMessages(messages))
        const pinned = await this.store.pinnedAmong(messages.map((message) => message.id))
        const urls = await this.files.urlsOf(
            messages.flatMap((message) => message.attachments.map((file) => file.fileKey)),
        )
        const approvals = await this.approvals.statesOf(workspaceId, viewerId, decisionIdsOf(messages))
        return { names, pinned, urls, approvals }
    }
}

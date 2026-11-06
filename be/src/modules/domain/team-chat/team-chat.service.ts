import { Injectable, Optional } from "@nestjs/common"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import type { ChatRoomEntity, ChatRoomMessageEntity } from "./persistence/entities"
import { InjectTeamChatTags } from "./team-chat.decorators"
import type { TeamChatTags } from "./team-chat.port"
import {
    chatDone,
    chatRefusal,
    cursorOf,
    directKeyOf,
    groupNameOf,
    pageSizeOf,
    positionOf,
    sendProblem,
    storedMentionsOf,
    uniqueMembers,
} from "./team-chat.policy"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { compareRooms } from "./team-chat-view.policy"
import { TeamChatViewsService } from "./team-chat-views.service"
import type {
    AgentPostInput,
    ApprovalPostInput,
    ChatMemberRef,
    ChatUpload,
    CreateRoomInput,
    LineInput,
    MessagePage,
    MessageView,
    ReportInput,
    RoomUnread,
    ChatRoomView,
    SendInput,
    TeamChatResult,
    UnreadView,
    UploadAsk,
} from "./team-chat.contracts"
import type {
    OptionalAgentLine,
    OptionalApprovalRequest,
    OptionalApprovalState,
    OptionalCount,
    OptionalId,
    OptionalKind,
    OptionalLine,
    OptionalReport,
    OptionalRoomView,
} from "./team-chat-store.contracts"

@Injectable()
/**
 * The internal team chat of a workspace: rooms (direct of two, or groups), their members (people and agents), the messages, the pins
 * and what each member has read. A person sees the rooms they sit in; an owner of the workspace sees them all. Every read and write
 * checks that, and every refusal is returned as data. The chat does no business: reports and approval cards are written by the
 * engine's jobs through the engine-side methods, a person can only ever write text. This is the one entry the doors inject; the
 * statements, the access rules, the views and the engine cards each live in their own class behind it.
 */
export class TeamChatRoomsService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly access: TeamChatAccessService,
        private readonly views: TeamChatViewsService,
        private readonly files: TeamChatFilesService,
        private readonly cards: TeamChatCardsService,
        private readonly approvals: TeamChatApprovalsService,
        @Optional() @InjectTeamChatTags() private readonly tags: TeamChatTags | null = null,
    ) {}

    /** The rooms the viewer sits in (all of them for an owner), newest message first. */
    async rooms(
        workspaceId: string,
        viewerId: string,
        kind: OptionalKind,
        member: OptionalId = null,
    ): Promise<Array<ChatRoomView>> {
        const owner = await this.access.isOwner(workspaceId, viewerId)
        const rows = await this.store.rooms(workspaceId, { viewerId, owner, kind, member })
        return (await this.views.roomViews(workspaceId, viewerId, rows)).toSorted(compareRooms)
    }

    /** One room for the viewer; null when it is absent or the viewer may not see it. */
    async room(workspaceId: string, viewerId: string, roomId: string): Promise<OptionalRoomView> {
        const found = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        return found === null ? null : this.views.roomView(workspaceId, viewerId, found)
    }

    /** One page of a room's thread, newest first; an empty page for a room the viewer may not see. */
    async messages(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        first: OptionalCount,
        after: OptionalId,
        pinnedOnly: boolean,
    ): Promise<MessagePage> {
        const empty: MessagePage = { nodes: [], hasNextPage: false, endCursor: null }
        if ((await this.access.visibleRoom(workspaceId, viewerId, roomId)) === null) return empty
        const position = after === null ? null : positionOf(after)
        if (after !== null && position === null) return empty
        const size = pageSizeOf(first)
        const keys = await this.store.threadKeys(workspaceId, roomId, position, size, pinnedOnly)
        const shown = keys.slice(0, size)
        const entities = await this.store.messagesByIds(
            workspaceId,
            shown.map((key) => key.id),
        )
        const hasNextPage = keys.length > size
        const [cursorKey] = hasNextPage ? shown.slice(-1) : []
        return {
            nodes: await this.views.messageViews(
                workspaceId,
                shown.flatMap((key) => entities.filter((entity) => entity.id === key.id)),
                viewerId,
            ),
            hasNextPage,
            endCursor: cursorKey === undefined ? null : cursorOf(cursorKey),
        }
    }

    /** What every room the viewer sits in has unread; only the rooms with something unread. */
    async unread(workspaceId: string, viewerId: string): Promise<UnreadView> {
        const rooms = await this.store.unreadRows(workspaceId, viewerId, null)
        return {
            total: rooms.reduce((sum, room) => sum + room.unreadCount, 0),
            mentionTotal: rooms.reduce((sum, room) => sum + room.mentionCount, 0),
            rooms: rooms.filter((room) => room.unreadCount > 0),
        }
    }

    /** Opens a room; a direct room of a pair that already has one answers that one. */
    createRoom(workspaceId: string, viewerId: string, input: CreateRoomInput): Promise<TeamChatResult<ChatRoomView>> {
        const others = uniqueMembers(input.members, { memberKind: "user", memberId: viewerId })
        return input.kind === "group"
            ? this.openGroup(workspaceId, viewerId, groupNameOf(input.name), others)
            : this.openDirect(workspaceId, viewerId, input.name, others)
    }

    /** Adds a person or an agent to a group. */
    async addMember(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        member: ChatMemberRef,
    ): Promise<TeamChatResult<ChatRoomView>> {
        const found = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return chatRefusal(TeamChatErrorCode.NotFound)
        if (found.kind === "direct" || !(await this.access.mayManage(workspaceId, viewerId, found)))
            return chatRefusal(TeamChatErrorCode.Forbidden)
        if (!(await this.access.allKnown(workspaceId, [member]))) return chatRefusal(TeamChatErrorCode.MemberUnknown)
        if ((await this.store.memberOf(roomId, member)) !== null) return chatRefusal(TeamChatErrorCode.AlreadyMember)
        await this.store.insertMember(workspaceId, roomId, member)
        return chatDone(await this.views.roomView(workspaceId, viewerId, found))
    }

    /** Removes a member from a group; a member may remove themselves. Answers null when the room went with its last member. */
    async removeMember(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        member: ChatMemberRef,
    ): Promise<TeamChatResult<OptionalRoomView>> {
        const found = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return chatRefusal(TeamChatErrorCode.NotFound)
        const itself = member.memberKind === "user" && member.memberId === viewerId
        if (found.kind === "direct" || !(itself || (await this.access.mayManage(workspaceId, viewerId, found))))
            return chatRefusal(TeamChatErrorCode.Forbidden)
        const held = await this.store.membersOf([roomId])
        const target = held.find((row) => row.memberKind === member.memberKind && row.memberId === member.memberId)
        if (target === undefined) return chatRefusal(TeamChatErrorCode.NotAMemberToRemove)
        const rest = held.filter((row) => row !== target)
        if (rest.length === 0) {
            await this.store.deleteRoom(roomId)
            return chatDone(null)
        }
        if (target.role === "owner" && !rest.some((row) => row.role === "owner"))
            return chatRefusal(TeamChatErrorCode.LastOwner)
        await this.store.deleteMember(roomId, member)
        return chatDone(await this.room(workspaceId, viewerId, roomId))
    }

    /** Writes a text message; the same client id from the same author in the same room is the same message. */
    async send(workspaceId: string, viewerId: string, input: SendInput): Promise<TeamChatResult<MessageView>> {
        const roomId = input.roomId ?? (await this.directRoomTo(workspaceId, viewerId, input.to))
        const found = roomId === null ? null : await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return chatRefusal(TeamChatErrorCode.NotFound)
        const mentions = uniqueMembers(input.mentions, null)
        const problem = sendProblem(input.body, mentions.length, input.fileKeys.length)
        if (problem !== null) return chatRefusal(problem)
        if (!(await this.access.allKnown(workspaceId, mentions))) return chatRefusal(TeamChatErrorCode.MemberUnknown)
        const retried = await this.store.sentBefore(workspaceId, found.id, viewerId, input.clientId)
        const stored =
            retried === null
                ? await this.storeText(workspaceId, found.id, viewerId, input, mentions)
                : chatDone(retried)
        if (!stored.ok) return chatRefusal(stored.refusal)
        if (retried === null) await this.tagAgents(workspaceId, viewerId, stored.value, mentions)
        const view = await this.views.viewOf(workspaceId, stored.value, viewerId)
        await this.store.moveReadPosition(workspaceId, found.id, viewerId, stored.value.id)
        return chatDone(view)
    }

    /** Issues the address a browser uploads one file of a room to; only a person who sees the room gets one. */
    async requestUpload(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        ask: UploadAsk,
    ): Promise<TeamChatResult<ChatUpload>> {
        if ((await this.access.visibleRoom(workspaceId, viewerId, roomId)) === null)
            return chatRefusal(TeamChatErrorCode.NotFound)
        return this.files.requestUpload(workspaceId, roomId, ask)
    }

    /** Mutes or unmutes a room for the viewer; only a member has a setting to change. */
    async setMuted(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        muted: boolean,
    ): Promise<TeamChatResult<ChatRoomView>> {
        const found = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return chatRefusal(TeamChatErrorCode.NotFound)
        if (!(await this.store.setMuted(roomId, viewerId, muted))) return chatRefusal(TeamChatErrorCode.NotMember)
        return chatDone(await this.views.roomView(workspaceId, viewerId, found))
    }

    /** Moves the viewer's read position to a message (the newest when none is named). */
    async markRead(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        messageId: OptionalId,
    ): Promise<TeamChatResult<RoomUnread>> {
        if ((await this.access.visibleRoom(workspaceId, viewerId, roomId)) === null)
            return chatRefusal(TeamChatErrorCode.NotFound)
        const seat = await this.store.memberOf(roomId, { memberKind: "user", memberId: viewerId })
        if (seat === null) return chatRefusal(TeamChatErrorCode.NotMember)
        const target = messageId === null ? null : await this.store.messageIn(workspaceId, roomId, messageId)
        if (messageId !== null && target === null) return chatRefusal(TeamChatErrorCode.NotFound)
        await this.store.moveReadPosition(workspaceId, roomId, viewerId, target?.id ?? null)
        const [row] = await this.store.unreadRows(workspaceId, viewerId, roomId)
        return chatDone(row ?? { roomId, unreadCount: 0, mentionCount: 0 })
    }

    /** Pins a message of a room; pinning a pinned message changes nothing. */
    async pin(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        messageId: string,
    ): Promise<TeamChatResult<MessageView>> {
        const message = await this.access.pinnable(workspaceId, viewerId, roomId, messageId)
        if (message === null) return chatRefusal(TeamChatErrorCode.NotFound)
        await this.store.insertPin(workspaceId, roomId, messageId, viewerId)
        return chatDone(await this.views.viewOf(workspaceId, message, viewerId))
    }

    /** Takes a pin off; unpinning a message that is not pinned changes nothing. */
    async unpin(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        messageId: string,
    ): Promise<TeamChatResult<MessageView>> {
        const message = await this.access.pinnable(workspaceId, viewerId, roomId, messageId)
        if (message === null) return chatRefusal(TeamChatErrorCode.NotFound)
        await this.store.deletePin(roomId, messageId)
        return chatDone(await this.views.viewOf(workspaceId, message, viewerId))
    }

    /** Where one decision stands, for the viewer; null when the workspace has no such request. */
    approvalOf(workspaceId: string, viewerId: string, decisionId: string): Promise<OptionalApprovalState> {
        return this.approvals.stateOf(workspaceId, viewerId, decisionId)
    }

    /** The request a decision card is about, with the group it stored; null when the workspace has no such request. */
    approvalRequest(workspaceId: string, decisionId: string): Promise<OptionalApprovalRequest> {
        return this.approvals.requestOf(workspaceId, decisionId)
    }

    /** Writes the report of a finished run into the room its agent reports to; one card per run, null when no room can be found. */
    postReport(workspaceId: string, report: ReportInput): Promise<OptionalReport> {
        return this.cards.postReport(workspaceId, report)
    }

    /** Posts the approval card of one decision to the rooms its rule names and the approvers' direct rooms; answers how many cards exist. */
    postApproval(workspaceId: string, approval: ApprovalPostInput): Promise<number> {
        return this.cards.postApproval(workspaceId, approval)
    }

    /** Writes one line of an agent or of the system into a room, or into the direct room with one person. */
    postMessage(workspaceId: string, line: LineInput): Promise<OptionalLine> {
        return this.cards.postMessage(workspaceId, line)
    }

    /** Says one line as an agent, named by id or module key, to one person (the owner by default). */
    postAsAgent(workspaceId: string, post: AgentPostInput): Promise<OptionalAgentLine> {
        return this.cards.postAsAgent(workspaceId, post)
    }

    /** Opens the direct room with one other member, or answers the one the pair already has. */
    private async openDirect(
        workspaceId: string,
        viewerId: string,
        name: OptionalId,
        others: ReadonlyArray<ChatMemberRef>,
    ): Promise<TeamChatResult<ChatRoomView>> {
        const [other] = others
        if (other === undefined || others.length > 1 || name !== null)
            return chatRefusal(TeamChatErrorCode.DirectNeedsTwo)
        if (!(await this.access.allKnown(workspaceId, others))) return chatRefusal(TeamChatErrorCode.MemberUnknown)
        const directKey = directKeyOf({ memberKind: "user", memberId: viewerId }, other)
        const room =
            (await this.store.roomByDirectKey(workspaceId, directKey)) ??
            (await this.store.insertRoom({
                workspaceId,
                createdBy: viewerId,
                kind: "direct",
                name: null,
                directKey,
                others,
            }))
        return this.opened(workspaceId, viewerId, room)
    }

    /** Opens a named group with its members. */
    private async openGroup(
        workspaceId: string,
        viewerId: string,
        name: OptionalId,
        others: ReadonlyArray<ChatMemberRef>,
    ): Promise<TeamChatResult<ChatRoomView>> {
        if (name === null) return chatRefusal(TeamChatErrorCode.GroupNeedsName)
        if (!(await this.access.allKnown(workspaceId, others))) return chatRefusal(TeamChatErrorCode.MemberUnknown)
        const room = await this.store.insertRoom({
            workspaceId,
            createdBy: viewerId,
            kind: "group",
            name,
            directKey: null,
            others,
        })
        return this.opened(workspaceId, viewerId, room)
    }

    private async opened(
        workspaceId: string,
        viewerId: string,
        room: ChatRoomEntity,
    ): Promise<TeamChatResult<ChatRoomView>> {
        return chatDone(await this.views.roomView(workspaceId, viewerId, room))
    }

    /** The direct room with the member, opened when the pair has none yet (the first message to someone opens it). */
    private async directRoomTo(workspaceId: string, viewerId: string, to: ChatMemberRef | null): Promise<OptionalId> {
        if (to === null) return null
        const opened = await this.createRoom(workspaceId, viewerId, { kind: "direct", name: null, members: [to] })
        return opened.ok ? opened.value.id : null
    }

    /** Verifies the files the message names, then stores the message; a file that does not verify refuses the send. */
    private async storeText(
        workspaceId: string,
        roomId: string,
        viewerId: string,
        input: SendInput,
        mentions: ReadonlyArray<ChatMemberRef>,
    ): Promise<TeamChatResult<ChatRoomMessageEntity>> {
        const attached = await this.files.verify(workspaceId, roomId, input.fileKeys)
        if (!attached.ok) return chatRefusal(attached.refusal)
        return chatDone(
            await this.store.insertText({
                workspaceId,
                roomId,
                authorId: viewerId,
                body: input.body,
                clientId: input.clientId,
                mentions: storedMentionsOf(mentions),
                attachments: attached.value,
            }),
        )
    }

    /** A person who mentions an agent starts its graph: the work core writes the tag wake, once per message and agent. */
    private async tagAgents(
        workspaceId: string,
        viewerId: string,
        message: ChatRoomMessageEntity,
        mentions: ReadonlyArray<ChatMemberRef>,
    ): Promise<void> {
        const tags = this.tags
        if (tags === null) return
        await Promise.all(
            mentions
                .filter((mention) => mention.memberKind === "agent")
                .map((mention) =>
                    tags.handOff(workspaceId, {
                        userId: viewerId,
                        agentId: mention.memberId,
                        roomId: message.roomId,
                        messageId: message.id,
                        text: message.body,
                    }),
                ),
        )
    }
}

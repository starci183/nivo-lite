import { Injectable, Optional } from "@nestjs/common"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { LessonCandidatesService } from "@modules/domain/brain-lessons"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import type { ChatMemberRef, MessageView, ChatRoomView } from "./team-chat.contracts"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { reactionsByMessageOf } from "./team-chat-reaction.policy"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import {
    decisionIdsOf,
    messageViewOf,
    nameKeyOf,
    refsOfMessages,
    repliedIdsOf,
    stopReplierIdsOf,
    roomViewOf,
    brainChangeViewerRoleOf,
    holdsBrainChange,
    type MessageViewContext,
    type RoomViewContext,
} from "./team-chat-view.policy"
import type { BrainChangeCost, BrainChangeViewerRole } from "./brain-change-card.contracts"
import { learningChangeIdsOf } from "./brain-change-card.policy"

/** The most members of a workspace read to name the people who replied to stop cards. */
const STOP_NAMES_LOOKED = 200

/** The most learning cards of one page whose cost is read (two indexed reads each). */
const COSTED_CARDS = 20

@Injectable()
/** Turns the rows of the chat into what a screen shows: names of people and agents, unread counts, pins, file addresses and decision states. */
export class TeamChatViewsService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly people: WorkspaceMembersReadService,
        private readonly agents: AgentDirectoryService,
        private readonly files: TeamChatFilesService,
        private readonly approvals: TeamChatApprovalsService,
        private readonly reactions: TeamChatReactionStoreService,
        // What a learning card's proposal cost (U1): absent in an app that composes neither, then no card shows a cost.
        @Optional() private readonly lessons?: LessonCandidatesService,
        @Optional() private readonly usage?: AiUsageOverviewService,
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
        const quotedRows = await this.store.messagesByIds(workspaceId, repliedIdsOf(messages))
        const names = await this.namesOf(workspaceId, refsOfMessages([...messages, ...quotedRows]))
        const pinned = await this.store.pinnedAmong(messages.map((message) => message.id))
        const urls = await this.files.urlsOf(
            messages.flatMap((message) => message.attachments.map((file) => file.fileKey)),
        )
        const approvals = await this.approvals.statesOf(workspaceId, viewerId, decisionIdsOf(messages))
        const reactions = reactionsByMessageOf(await this.reactions.rowsAmong(messages.map((message) => message.id)), {
            memberKind: "user",
            memberId: viewerId,
        })
        const stopNames = await this.stopNamesOf(workspaceId, stopReplierIdsOf(messages))
        const viewerRole = holdsBrainChange(messages) ? await this.viewerRoleOf(workspaceId, viewerId) : undefined
        const brainChangeCosts =
            viewerRole === "owner" || viewerRole === "manager"
                ? await this.learningCostsOf(workspaceId, messages)
                : undefined
        return {
            names,
            pinned,
            urls,
            approvals,
            reactions,
            quoted: new Map(quotedRows.map((row) => [row.id, row])),
            stopNames,
            ...(viewerRole === undefined ? {} : { viewerRole }),
            ...(brainChangeCosts === undefined ? {} : { brainChangeCosts }),
        }
    }

    /**
     * What producing each learning card of the page cost: the calls booked to the lessons that carry its change id (the judgements and
     * the draft), exact. Read only for an owner or manager, at most 20 cards a page, each by two indexed reads.
     */
    private async learningCostsOf(
        workspaceId: string,
        messages: ReadonlyArray<ChatRoomMessageEntity>,
    ): Promise<ReadonlyMap<string, BrainChangeCost>> {
        const lessons = this.lessons
        const usage = this.usage
        if (lessons === undefined || usage === undefined) return new Map()
        const changeIds = learningChangeIdsOf(
            messages.map((message) => message.ref?.agent_message ?? null),
            COSTED_CARDS,
        )
        const costs = new Map<string, BrainChangeCost>()
        for (const changeId of changeIds) {
            const group = await lessons.ofChange(workspaceId, changeId)
            const cost = await usage.lessonsCostOf(
                workspaceId,
                group.map((lesson) => lesson.id),
            )
            costs.set(changeId, { credits: cost.credits, usd: cost.costUsd })
        }
        return costs
    }

    /**
     * The viewer's role for a `brain.change` card: owner, manager or member. Read only when the page holds such a card, from the
     * directory read the stop names use (owners and managers first, bounded), so a deciding viewer is always found in it.
     */
    private async viewerRoleOf(workspaceId: string, viewerId: string): Promise<BrainChangeViewerRole> {
        const rows = await this.people.directory(workspaceId, STOP_NAMES_LOOKED)
        const row = rows.find((one) => one.user_id === viewerId && one.status === "active")
        return brainChangeViewerRoleOf(row?.role ?? null)
    }

    /**
     * The names of the people who replied to stop cards, by the id the stop keeps: a member seat (the stop door keeps the seat) or an
     * account. Read only when a card on the page has replies; the deciders (owners, managers) come first in the directory read.
     */
    private async stopNamesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<Map<string, string>> {
        if (ids.length === 0) return new Map()
        const wanted = new Set(ids)
        const [seats, accounts] = await Promise.all([
            this.people.directory(workspaceId, STOP_NAMES_LOOKED),
            this.people.namesOf(workspaceId, ids),
        ])
        return new Map([
            ...accounts.map((person) => [person.userId, person.displayName] as const),
            ...seats.filter((seat) => wanted.has(seat.id)).map((seat) => [seat.id, seat.display_name] as const),
        ])
    }
}

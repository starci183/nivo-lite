import { Injectable } from "@nestjs/common"
import { TeamChatService } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatTypingError, ChatTypingErrorCode } from "./errors/chat-typing.error"
import type { ChatTypingFrame, ChatTypingSignal, TypingAgent } from "./chat-typing.contracts"
import { chatTypingTopic } from "./chat-typing.policy"

/** Signals are transient UI hints; a lost stop event must disappear quickly. */
const TYPING_TTL_MS = 5000

/** The most accounts one agent's typing hint is sent to. */
const RECIPIENT_LIMIT = 500

@Injectable()
/** Authorizes chat typing at the boundary of the team-chat room: only a person who sits in the room can type in it. */
export class ChatTypingService {
    constructor(
        private readonly chat: TeamChatService,
        private readonly seats: WorkspaceMemberSeatsService,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Publishes the admitted member's identity to the typing topic of every other admitted member; the client cannot impersonate another account. */
    async set(principalId: string, workspaceId: string, roomId: string, typing: boolean): Promise<ChatTypingSignal> {
        const room = await this.chat.room(workspaceId, principalId, roomId)
        const member = room?.members.find((entry) => entry.memberKind === "user" && entry.memberId === principalId)
        if (room === null || member === undefined) throw new ChatTypingError({ code: ChatTypingErrorCode.RoomNotFound })
        const now = this.clock.now()
        const signal: ChatTypingSignal = {
            id: principalId,
            name: member.name,
            avatarSeed: principalId,
            typing,
            expiresAt: new Date(now.getTime() + (typing ? TYPING_TTL_MS : 0)).toISOString(),
        }
        const at = now.toISOString()
        const frame: ChatTypingFrame = {
            id: `${principalId}:${at}`,
            actorId: principalId,
            actorName: member.name,
            state: typing ? "start" : "stop",
            at,
        }
        const recipients = room.members.filter((entry) => entry.memberKind === "user" && entry.memberId !== principalId)
        await Promise.all(
            recipients.map((entry) => this.hub.publish(chatTypingTopic(entry.memberId, workspaceId, roomId), frame)),
        )
        return signal
    }

    /**
     * Publishes that an agent is working on an answer to every active account of the workspace, from the moment its turn begins to the
     * moment it ends. The server calls it, never a client, so there is no caller to prove: the workspace is the wake's own.
     */
    async setAgent(workspaceId: string, roomId: string, agent: TypingAgent, typing: boolean): Promise<void> {
        const at = this.clock.now().toISOString()
        const frame: ChatTypingFrame = {
            id: `${agent.id}:${at}`,
            actorId: agent.id,
            actorName: agent.name,
            state: typing ? "start" : "stop",
            at,
        }
        const recipients = await this.seats.activeUsers(workspaceId, RECIPIENT_LIMIT)
        await Promise.all(
            recipients.map((recipient) =>
                this.hub.publish(chatTypingTopic(recipient.userId, workspaceId, roomId), frame),
            ),
        )
    }
}

import { Injectable } from "@nestjs/common"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { ChatTypingFrame, ChatTypingSignal, TypingAgent } from "./chat-typing.contracts"
import { chatTypingTopic } from "./chat-typing.policy"

/** Signals are transient UI hints; a lost stop event must disappear quickly. */
const TYPING_TTL_MS = 5000

/** The most accounts one agent's typing hint is sent to. */
const RECIPIENT_LIMIT = 500

@Injectable()
/** Authorizes chat typing at the same workspace and target boundary as persistent chat markers. */
export class ChatTypingService {
    constructor(
        private readonly markers: ChatMarkersService,
        private readonly seats: WorkspaceMemberSeatsService,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Publishes the admitted member's identity to the typing topic of every other admitted member; the client cannot impersonate another account. */
    async set(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        typing: boolean,
    ): Promise<ChatTypingSignal> {
        const member = await this.markers.requireTarget(principalId, workspaceId, target)
        const now = this.clock.now()
        const signal: ChatTypingSignal = {
            id: member.userId,
            name: member.displayName,
            avatarSeed: member.userId,
            typing,
            expiresAt: new Date(now.getTime() + (typing ? TYPING_TTL_MS : 0)).toISOString(),
        }
        const at = now.toISOString()
        const frame: ChatTypingFrame = {
            id: `${member.userId}:${at}`,
            actorId: member.userId,
            actorName: member.displayName,
            state: typing ? "start" : "stop",
            at,
        }
        const recipients = await this.markers.memberIds(principalId, workspaceId, target)
        await Promise.all(
            recipients
                .filter((recipientId) => recipientId !== member.userId)
                .map((recipientId) => this.hub.publish(chatTypingTopic(recipientId, workspaceId, target), frame)),
        )
        return signal
    }

    /**
     * Publishes that an agent is working on an answer to every active account of the workspace, from the moment its turn begins to the
     * moment it ends. The server calls it, never a client, so there is no caller to prove: the workspace is the wake's own.
     */
    async setAgent(workspaceId: string, target: ChatTarget, agent: TypingAgent, typing: boolean): Promise<void> {
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
                this.hub.publish(chatTypingTopic(recipient.userId, workspaceId, target), frame),
            ),
        )
    }
}

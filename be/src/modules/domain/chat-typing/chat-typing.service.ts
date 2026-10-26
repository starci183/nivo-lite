import { Injectable } from "@nestjs/common"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { ChatTypingChannel, ChatTypingFrame, ChatTypingSignal } from "./chat-typing.contracts"
import { chatTypingTopic } from "./chat-typing.policy"

/** Signals are transient UI hints; a lost stop event must disappear quickly. */
const TYPING_TTL_MS = 5000

const channelOf = (workspaceId: string, target: ChatTarget): ChatTypingChannel => ({
    topic:
        target.conversationId === null
            ? `chat-typing:${workspaceId.toLowerCase()}:room:${target.room ?? "office"}`
            : `chat-typing:${workspaceId.toLowerCase()}:conversation:${target.conversationId.toLowerCase()}`,
    event: "typing",
    private: true,
    ttlMs: TYPING_TTL_MS,
})

@Injectable()
/** Authorizes chat typing at the same workspace and target boundary as persistent chat markers. */
export class ChatTypingService {
    constructor(
        private readonly markers: ChatMarkersService,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Describes the receive-only private channel after checking membership and target existence. */
    async channel(principalId: string, workspaceId: string, target: ChatTarget): Promise<ChatTypingChannel> {
        await this.markers.requireTarget(principalId, workspaceId, target)
        return channelOf(workspaceId, target)
    }

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
}

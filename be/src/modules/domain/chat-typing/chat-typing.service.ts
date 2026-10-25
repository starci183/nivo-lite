import { Injectable } from "@nestjs/common"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectRealtimePublisher } from "@modules/platform/realtime"
import type { RealtimePublisher } from "@modules/platform/realtime"
import type { ChatTypingChannel, ChatTypingSignal } from "./chat-typing.contracts"

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
        @InjectRealtimePublisher() private readonly realtime: RealtimePublisher,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Describes the receive-only private channel after checking membership and target existence. */
    async channel(principalId: string, workspaceId: string, target: ChatTarget): Promise<ChatTypingChannel> {
        await this.markers.requireTarget(principalId, workspaceId, target)
        return channelOf(workspaceId, target)
    }

    /** Broadcasts the admitted member's identity; the client cannot impersonate another account. */
    async set(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        typing: boolean,
    ): Promise<ChatTypingSignal> {
        const member = await this.markers.requireTarget(principalId, workspaceId, target)
        const channel = channelOf(workspaceId, target)
        const signal: ChatTypingSignal = {
            id: member.userId,
            name: member.displayName,
            avatarSeed: member.userId,
            typing,
            expiresAt: new Date(this.clock.now().getTime() + (typing ? TYPING_TTL_MS : 0)).toISOString(),
        }
        await this.realtime.publishPrivate({ topic: channel.topic, event: channel.event, payload: { ...signal } })
        return signal
    }
}

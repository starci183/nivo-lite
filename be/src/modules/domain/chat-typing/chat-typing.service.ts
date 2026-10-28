import { Injectable } from "@nestjs/common"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { ChatTypingFrame, ChatTypingSignal } from "./chat-typing.contracts"
import { chatTypingTopic } from "./chat-typing.policy"

/** Signals are transient UI hints; a lost stop event must disappear quickly. */
const TYPING_TTL_MS = 5000

@Injectable()
/** Authorizes chat typing at the same workspace and target boundary as persistent chat markers. */
export class ChatTypingService {
    constructor(
        private readonly markers: ChatMarkersService,
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
}

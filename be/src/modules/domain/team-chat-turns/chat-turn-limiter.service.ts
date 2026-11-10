import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { ChatTurnLimit, RoomAdmission } from "./team-chat-turns.contracts"
import { InjectTeamChatTurnsOptions } from "./team-chat-turns.decorators"
import type { TeamChatTurnsOptions } from "./team-chat-turns.options"
import { DEFAULT_CHAT_TURN_LIMIT, roomAdmissionOf } from "./team-chat-turns.policy"

/** What the limiter keeps of one room: when its turns started in the window, and whether the pause was already said. */
interface RoomWindow {
    starts: Array<number>
    noticed: boolean
}

@Injectable()
/**
 * The rate limit of chat turns per room: at most `limit.turns` turns per `limit.windowMs`. Over it the agent says ONCE that it pauses and
 * stays quiet until the window frees a place. Kept in the api process's memory (one api serves the team chat): a restart starts every
 * window afresh, which can only let a few more turns through, never fewer.
 */
export class ChatTurnLimiterService {
    private readonly rooms = new Map<string, RoomWindow>()
    private readonly limit: ChatTurnLimit

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectTeamChatTurnsOptions() options: TeamChatTurnsOptions,
    ) {
        this.limit = options.limit ?? DEFAULT_CHAT_TURN_LIMIT
    }

    /** Counts one more turn of a room and says whether it runs, whether the pause is said now, or whether the agent stays quiet. */
    admit(roomKey: string): RoomAdmission {
        const now = this.clock.now().getTime()
        const window = this.rooms.get(roomKey) ?? { starts: [], noticed: false }
        window.starts = window.starts.filter((at) => at > now - this.limit.windowMs)
        const admission = roomAdmissionOf(window.starts, window.noticed, now, this.limit)
        if (admission === "run") {
            window.starts.push(now)
            window.noticed = false
        }
        if (admission === "pause_notice") window.noticed = true
        this.rooms.set(roomKey, window)
        return admission
    }
}

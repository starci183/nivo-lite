import type { ChatTurnLimit } from "./team-chat-turns.contracts"

/** The chat turns' options: the rate limit per room (absent takes twenty turns per ten minutes). */
export interface TeamChatTurnsOptions {
    /** The most turns one room starts in one window. */
    readonly limit?: ChatTurnLimit | undefined
}

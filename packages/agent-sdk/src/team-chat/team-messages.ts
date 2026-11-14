/** Who in the team a message is for: the founder alone, the room of the agent's own module, or the room of the whole shop. */
export type TeamAudience = "own" | "everyone" | "founder"

/** Plain words to the team. */
export interface TeamText {
    /** The card kind. */
    readonly kind: "message.text"
    /** What the message is for: tell, ask, or report. */
    readonly intent: "notify" | "ask" | "report"
    /** The heading. */
    readonly title: string
    /** The words. */
    readonly text: string
    /** Who reads it; the founder when absent. */
    readonly audience?: TeamAudience | undefined
}

/**
 * An agent's answer to a person of the team, posted in the room of the person's message as a reply to it (the `team.chat` step posts
 * it from its output). The executor reads the room from the message and posts there only when that message is a person's line of the
 * room the run is about; one answer per message and agent.
 */
export interface TeamChatAnswer {
    /** The card kind. */
    readonly kind: "chat.answer"
    /** The person's message the answer replies to. */
    readonly messageId: string
    /** The words. */
    readonly text: string
    /** No audience: the answer goes to the room of the message, nowhere else. */
    readonly audience?: undefined
}

/** The longest plain message to the team. */
export const TEAM_TEXT_MAX = 4000

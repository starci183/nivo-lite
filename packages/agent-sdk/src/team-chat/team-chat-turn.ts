/** The key of the chat-turn workflow inside an agent (`<module>.team-chat` as the thread flag names it); what the router pins. */
export const TEAM_CHAT_WORKFLOW_KEY = "team-chat"

/** Where a team chat line was said: a person's private room with the agent, or a room of several people (the common or a team room). */
export type TeamChatRoom = "direct" | "common"

/** Why the turn runs: a person spoke to the agent, or a person pressed "Ghi vao Second Brain" on a message. */
export type TeamChatIntent = "answer" | "capture"

/** Who the person who asked is in the shop: the owner and a manager govern it; staff operate it. */
export type TeamChatStanding = "owner" | "manager" | "staff"

/** The most room lines a chat turn is shown (newest kept, oldest first). */
export const TEAM_CHAT_LINES_MAX = 12

/** The longest room line a chat turn is shown. */
export const TEAM_CHAT_LINE_MAX = 300

/** The longest asked message a chat turn reads. */
export const TEAM_CHAT_TEXT_MAX = 2000

/** The longest answer a chat turn posts. */
export const TEAM_CHAT_ANSWER_MAX = 4000

/** Who asked, as the turn is told: a display name and their standing in the shop. */
export type TeamChatAsker = {
    /** The person's name in the shop. */
    readonly name: string
    /** Owner, manager or staff. */
    readonly standing: TeamChatStanding
}

/** One line of the room as the turn is shown it. */
export type TeamChatLine = {
    /** The message id. */
    readonly id: string
    /** Who wrote it: a person, an agent, or the system. */
    readonly by: "person" | "agent" | "system"
    /** Their name. */
    readonly name: string
    /** The words, cut to a line. */
    readonly text: string
    /** When, ISO. */
    readonly at: string
}

/** What a chat turn works on: the asked message, who asked, where, and the room around it. */
export type TeamChatInput = {
    /** The room the message was written in. */
    readonly roomId: string
    /** The message the turn answers (and the one a truth change quotes). */
    readonly messageId: string
    /** Its words. */
    readonly text: string
    /** A private room with the agent, or a room of several people. */
    readonly room: TeamChatRoom
    /** Answer the person, or file the message as a truth change (the "Save to Second Brain" action). */
    readonly intent: TeamChatIntent
    /** Who wrote it and their standing. */
    readonly asker: TeamChatAsker
    /** The room's latest lines, oldest first, bounded. */
    readonly lines: ReadonlyArray<TeamChatLine>
    /** The line the message replies to, or null. */
    readonly replyTo: TeamChatLine | null
    /** The team's language. */
    readonly locale: "vi" | "en"
}

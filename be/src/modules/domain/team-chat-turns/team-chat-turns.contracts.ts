import type { TeamChatIntent, TeamChatLine, TeamChatRoom, TeamChatStanding } from "@nivo-lite/blocks-core"

/** The room a person wrote in, as the team chat already holds it (no read is made to know it). */
export interface HeardRoom {
    /** The room. */
    readonly id: string
    /** `direct` (a pair) or `group`. */
    readonly kind: "direct" | "group"
    /** The sorted pair of a direct room (`"agent:<id>|user:<id>"`); null for a group. */
    readonly directKey: string | null
}

/** The line a person's message replies to, as the team chat already read it to check the reply. */
export interface HeardReply {
    /** The message. */
    readonly id: string
    /** `user`, `agent` or `system`. */
    readonly authorKind: string
    /** The account or the agent; null for a system line. */
    readonly authorId: string | null
    /** `text`, `report`, `approval` or `system`. */
    readonly kind: string
    /** The structured message an agent line carries, as stored JSON text; null for a plain line. */
    readonly agentMessage: string | null
    /** Its words. */
    readonly body: string
    /** When it was written, ISO. */
    readonly createdAt: string
}

/** A person's new message in the team chat, as the team chat tells its one listener right after storing it. */
export interface PersonLineHeard {
    /** The workspace. */
    readonly workspaceId: string
    /** The account of the person who wrote it. */
    readonly userId: string
    /** Where. */
    readonly room: HeardRoom
    /** The message. */
    readonly message: { readonly id: string; readonly body: string; readonly createdAt: string }
    /** The agents the message names, in the order written, once each. */
    readonly agentMentions: ReadonlyArray<string>
    /** The line it replies to, or null. */
    readonly repliedTo: HeardReply | null
}

/** Whom a person's message is for: the agents that take a turn, in order, and the kind of room. */
export interface TurnTargets {
    /** The agents, in order, once each; empty when the message starts no turn. */
    readonly agentIds: ReadonlyArray<string>
    /** A private room with the agent, or a room of several people. */
    readonly room: TeamChatRoom
}

/** Who asked, read once per started turn: the member seat, the name, the standing. */
export interface AskerSeat {
    /** The member id (workspace_members.id) the wake records as its actor. */
    readonly memberId: string
    /** The display name. */
    readonly name: string
    /** Owner, manager or staff. */
    readonly standing: TeamChatStanding
}

/** The params a chat turn's workflow receives (its contract), as the router writes them into the pinned tag. */
export interface TurnParams {
    readonly roomId: string
    readonly messageId: string
    readonly text: string
    readonly room: TeamChatRoom
    readonly intent: TeamChatIntent
    readonly asker: { readonly name: string; readonly standing: TeamChatStanding }
    readonly lines: ReadonlyArray<TeamChatLine>
    readonly replyTo: TeamChatLine | null
    readonly locale: "vi" | "en"
}

/** What the rate limit says of one more turn in a room: run it, say once that the agent pauses, or stay quiet. */
export type RoomAdmission = "run" | "pause_notice" | "quiet"

/** The rate limit of chat turns per room. */
export interface ChatTurnLimit {
    /** The most turns one room starts in one window. */
    readonly turns: number
    /** The window, in milliseconds. */
    readonly windowMs: number
}

/** What pressing "Ghi vào Second Brain" on a message asks. */
export interface CaptureRequest {
    /** The person's message to file. */
    readonly messageId: string
    /** The agent that files it; absent in a private room with an agent (that agent), required in a room of several people. */
    readonly agentId: string | null
    /**
     * The truth as the person wrote it in the form: filed at once through the truth graph's change requests, with no AI call. Absent:
     * the agent drafts it in a chat turn of intent `capture`.
     */
    readonly fact: CaptureFact | null
}

/** A truth the person names on the form. */
export interface CaptureFact {
    readonly subjectLabel: string
    readonly attributeLabel: string
    /** The new value; null retires the truth in force. */
    readonly value: string | null
    readonly unit: string | null
    readonly validFrom: string | null
    readonly validTo: string | null
}

/** What the capture did. */
export type CaptureOutcome =
    /** The change request was filed; the card waits in the room for the owner. */
    | "filed"
    /** The truth in force already says it. */
    | "already_true"
    /** The same proposal already waits. */
    | "already_filed"
    /** The agent was asked to draft and file it (a chat turn started). */
    | "drafting"
    /** The same message was handed to the agent before. */
    | "duplicate"
    /** The person is neither the owner nor a manager. */
    | "not_allowed"
    /** No such message in a room the person sees, or no such agent. */
    | "not_found"
    /** The message is no person's line. */
    | "not_person_line"
    /** A room of several people: name the agent. */
    | "agent_required"
    /** That agent's module ships no chat turn (`TEAM_CHAT_MODULES`): nothing to draft with. */
    | "no_chat_turn"

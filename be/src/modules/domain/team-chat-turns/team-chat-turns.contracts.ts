import type { TeamChatIntent, TeamChatLine, TeamChatRoom, TeamChatStanding } from "@nivo-lite/agent-sdk/team-chat"

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
    /** The room the person wrote in. */
    readonly roomId: string
    /** The person's message. */
    readonly messageId: string
    /** The asked words. */
    readonly text: string
    /** A private room with the agent, or a room of several people. */
    readonly room: TeamChatRoom
    /** What the turn was started for. */
    readonly intent: TeamChatIntent
    /** Who asked: the name and the standing. */
    readonly asker: TurnAsker
    /** The room lines before the asked message, oldest first. */
    readonly lines: ReadonlyArray<TeamChatLine>
    /** The line the message replies to, or null. */
    readonly replyTo: TeamChatLine | null
    /** The language the turn answers in. */
    readonly locale: "vi" | "en"
}

/** Who asked a chat turn, as its params name them. */
export interface TurnAsker {
    /** The display name. */
    readonly name: string
    /** Owner, manager or staff. */
    readonly standing: TeamChatStanding
}

/** The one line an agent says when its room reached the limit of turns. */
export interface PauseLine {
    /** The title of the line. */
    readonly title: string
    /** Its words. */
    readonly text: string
}

/**
 * Why a message named an agent and started no chat turn of it: its module ships no chat turn, it is no agent of the workspace, the
 * tag was not written (the asker is no active member, or the tag door refused), the router failed, or the message is one the router
 * starts no turn for (a reply to a card a person decides on, an agent named in another agent's private room).
 */
export type UnroutedCode = "no_chat_turn" | "no_agent" | "not_tagged" | "route_failed" | "outside_turn"

/** One agent a message named whose chat turn did not start. */
export interface UnroutedTurn {
    /** The agent the message named. */
    readonly agentId: string
    /** Why its turn did not start. */
    readonly code: UnroutedCode
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

/** What pressing "Save to Second Brain" on a message asks. */
export interface CaptureRequest {
    /** The person's message to file. */
    readonly messageId: string
    /** The agent that files it; absent in a private room with an agent (that agent), required in a room of several people. */
    readonly agentId?: string | null | undefined
    /**
     * The truth as the person wrote it in the form: filed at once through the truth graph's change requests, with no AI call. Absent:
     * the agent drafts it in a chat turn of intent `capture`.
     */
    readonly fact?: CaptureFact | null | undefined
}

/** A truth the person names on the form. */
export interface CaptureFact {
    /** The subject, as people write it. */
    readonly subjectLabel: string
    /** The attribute, as people write it. */
    readonly attributeLabel: string
    /** The new value; null retires the truth in force. */
    readonly value?: string | null | undefined
    /** The unit of a number value, or null. */
    readonly unit?: string | null | undefined
    /** From when the value holds (ISO date), or null for now. */
    readonly validFrom?: string | null | undefined
    /** Until when the value holds (ISO date), or null for no stated end. */
    readonly validTo?: string | null | undefined
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

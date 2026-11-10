import type { EffectFacts, TeamAudience } from "@nivo-lite/blocks-core"
import type { RoomPurpose } from "./team-chat.contracts"

/** The purposes only one room of a workspace holds: the common room, and the room of each module. */
export type SharedPurpose = "common" | "module"

/** Who an agent addresses by a room's purpose: its own team's room, or the room of the whole workspace. */
export type PurposeAudience = "own" | "everyone"

/** The purpose columns of a room row. */
export interface PurposeColumns {
    /** What the room is for. */
    readonly purpose: RoomPurpose
    /** The module of a module room; null otherwise. */
    readonly purposeModule: string | null
}

/** A room an agent addresses by purpose, and whether the agent holds the right to post in it. */
export interface PurposeRoom {
    /** The room id. */
    readonly id: string
    /** The group name. */
    readonly name: string
    /** The purpose the room was found by. */
    readonly purpose: SharedPurpose
    /** The module of a module room; null for the common room. */
    readonly module: string | null
    /** Whether the agent sits in the room with the right to post there (a seat alone is not the right). */
    readonly mayPost: boolean
}

/** The group room an audience adds beside the founder's direct room, or why it adds none (`skipped`). */
export interface GroupRoute {
    /** The group room that also gets the line; null when none does. */
    readonly room: PurposeRoom | null
    /** Why no group room gets it: `no_post_right`, `no_team_room` or `no_common_room`; null when one does or none was asked. */
    readonly skipped: string | null
}

/** A line or card an agent posts to the team, built by the server: the kind, intent, heading, one readable line and content. */
export interface TeamCardMessage {
    /** The registered kind of the content. */
    readonly kind: string
    /** What the message is for. */
    readonly intent: string
    /** The heading. */
    readonly title: string
    /** The one line the chat shows where no card is drawn. */
    readonly summary: string
    /** The content, in the shape its kind declares. */
    readonly payload: unknown
    /** The answers the card offers as one-tap replies (the envelope's `options`): each is the text of a reply to this line. */
    readonly options?: ReadonlyArray<{ readonly id: string; readonly label: string }> | undefined
    /** Which occurrence of a repeating card this content is (a stopped workflow stopping again), so a retry of the same one folds nothing twice. */
    readonly occurrence?: string | undefined
    /** The record the message is about, with where it opens. */
    readonly work?: { readonly label: string; readonly href: string } | undefined
}

/** A card an agent posts to an audience, once per key. */
export interface TeamCardPost {
    /** The agent that speaks. */
    readonly agentId: string
    /** Who reads it: the agent's own team, everyone, or the founder. */
    readonly audience: TeamAudience
    /** What it says. */
    readonly message: TeamCardMessage
    /** The retry key of the line: the same key from the same agent in the same room is the same line. */
    readonly key: string
}

/** A posted card: the line in the founder's direct room, and the facts of every room it reached. */
export interface TeamCardPosted {
    /** The line in the founder's direct room (written, or the one a retry found). */
    readonly messageId: string
    /** `requested`, `rooms` (purpose, roomId, roomName of each room posted to), `skipped` and `module`. */
    readonly facts: EffectFacts
}

/** The room of an audience for one agent, or why there is none: the agent is not of the workspace, or the workspace has no such room. */
export type PurposeRoomFound =
    | { readonly found: true; readonly room: PurposeRoom }
    | { readonly found: false; readonly reason: "agent_unknown" | "room_missing"; readonly module: string | null }

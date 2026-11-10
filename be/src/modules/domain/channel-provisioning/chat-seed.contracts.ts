/** The schema name a chat seed document carries. */
export const CHAT_SEED_SCHEMA = "nivo/chat-seed@1"

/**
 * Who sits in a room or speaks in it: a person of the workspace by role, or the agent of a module; an agent seat may carry the right to
 * post in the group (`mayPost`, absent is no right).
 */
export type ChatSeedWho = { readonly role: "owner" | "staff" } | { readonly agent: string; readonly mayPost?: boolean }

/** Which day a line was said, counted in the shop's own time zone. */
export type ChatSeedDay = "today" | "yesterday"

/** One line of a seeded room; its key is stable, so a rerun finds the line it wrote. */
export interface ChatSeedMessage {
    /** The key of the line inside its room. */
    readonly key: string
    /** Who said it. */
    readonly from: ChatSeedWho
    /** The day it was said. */
    readonly day: ChatSeedDay
    /** The time of that day, `HH:MM`. */
    readonly time: string
    /** The words; for a card, the readable line. */
    readonly body: string
    /** The structured message of an agent line (its kind, intent and payload), which a screen draws as a card. */
    readonly agentMessage?: Readonly<Record<string, unknown>>
}

/** What a seeded group is for: a plain group, the common room of the workspace, or the room of one module's team. */
export type ChatSeedPurpose = "group" | "common" | "module"

/** The purpose of a seeded group with its module. */
export interface ChatSeedRoomPurpose {
    /** What the group is for. */
    readonly purpose: ChatSeedPurpose
    /** The module whose team room it is; null unless the purpose is `module`. */
    readonly module: string | null
}

/** One group room of the seed: a stable id, a name, its purpose, who sits in it and what was said. */
export interface ChatSeedRoom {
    /** The id of the room, the same in every run. */
    readonly id: string
    /** The name of the group. */
    readonly name: string
    /** What the group is for; `group` when the document does not say. */
    readonly purpose: ChatSeedPurpose
    /** The module whose team room it is; null unless the purpose is `module`. */
    readonly module: string | null
    /** Who sits in it; the owner always does. */
    readonly members: ReadonlyArray<ChatSeedWho>
    /** What was said, oldest first. */
    readonly messages: ReadonlyArray<ChatSeedMessage>
}

/** Who the customer of a conversation is for the workspace's connectors, as the `identity.find` role answered it. */
export interface PartyContext {
    /** True when a connector knows the customer. */
    readonly found: boolean
    /** The connector's id of the party, or null while it does not know the customer. */
    readonly partyId: string | null
    /** The party's name as the connector keeps it, or empty. */
    readonly name: string
}

/** The party of a conversation, or null when no connector plays `identity.find` or the channel names no identity. */
export type OptionalPartyContext = PartyContext | null

/** One source a turn actually used, in the Hub card contract's shape (1 MCP live data, 2 Second Brain, 3 lessons, 4 base). */
export interface HubNoteSource {
    /** The data layer. */
    readonly layer: 1 | 2 | 3 | 4
    /** The kind of record: mcp_tool, brain_document, brain_fact, brain_lesson, base_document. */
    readonly kind: string
    /** The record: a tool name, a knowledge source or fact id. */
    readonly ref: string
    /** What the reader sees. */
    readonly label: string
    /** Where it opens, when it does. */
    readonly href?: string
}

/** The knowledge a turn read (Second Brain facts and documents, NIVO base documents), as the sources its cards list. */
export type KnowledgeSources = ReadonlyArray<HubNoteSource>

/** The card types of contract v1 a customer turn posts. */
export type HubNoteType = "handoff_note" | "action_done"

/** One label/value row of a card. */
export interface HubNoteField {
    /** What the row is about, in the reader's language. */
    readonly label: string
    /** Its value; a row with an empty value is left out of the card. */
    readonly value: string
}

/** A result card posted to the Hub (Hub card contract v1). */
export interface HubNote {
    /** The workspace. */
    readonly workspaceId: string
    /** The Hub room the card goes to; a text that is no room key lets the database route it to the agent's home room. */
    readonly room: string
    /** The card type of contract v1. */
    readonly type: HubNoteType
    /** The title. */
    readonly title: string
    /** Label/value rows. */
    readonly fields: ReadonlyArray<HubNoteField>
    /** The speaking agent's name. */
    readonly authorName: string
    /** The long text of the card, when it has one. */
    readonly body?: string
    /** The sources the turn actually used; none when it used none. */
    readonly sources?: ReadonlyArray<HubNoteSource>
}

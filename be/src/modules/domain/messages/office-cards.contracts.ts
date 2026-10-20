/** The Hub rooms besides the general Office room (null). */
export const OFFICE_ROOM_KEYS = ["executive", "frontdesk", "sales", "marketing", "care", "accounting"] as const

/** One Hub room key. */
export type OfficeRoomKey = (typeof OFFICE_ROOM_KEYS)[number]

/** A room key, or null for the general Office room. */
export type OptionalRoom = OfficeRoomKey | null

/** A room key as a caller names it; null is the general Office room. Checked against the Hub rooms before use. */
export type RoomKeyText = string | null

/** The result card types an agent may post. */
export const OFFICE_CARD_TYPES = [
    "draft_post",
    "video_ready",
    "approval_request",
    "schedule_confirmed",
    "weekly_report",
    "booking_held",
    "daily_summary",
    "handoff_note",
    "exception",
] as const

/** One result card type. */
export type OfficeCardType = (typeof OFFICE_CARD_TYPES)[number]

/** The actions a card may offer; they reuse the execution and work item decisions. */
export const OFFICE_CARD_ACTIONS = ["approve", "decline", "edit"] as const

/** One card action. */
export type OfficeCardAction = (typeof OFFICE_CARD_ACTIONS)[number]

/** One labelled row of a card. */
export interface OfficeCardField {
    /** The label. */
    readonly label: string
    /** The value, already formatted. */
    readonly value: string
}

/** One image or video of a card. */
export interface OfficeCardMedia {
    /** Image or video. */
    readonly kind: "image" | "video"
    /** An https URL or an app-relative path. */
    readonly url: string
    /** The line under it. */
    readonly caption?: string
}

/** One timed or bulleted line of a card (a script beat, a report bullet). */
export interface OfficeCardLine {
    /** The time or marker in front of it; may be empty. */
    readonly at: string
    /** The text. */
    readonly text: string
}

/** The link at the foot of a card. */
export interface OfficeCardLink {
    /** The words. */
    readonly label: string
    /** An https URL or an app-relative path. */
    readonly href: string
}

/** The data layers an agent reads, by precedence: 1 MCP live data, 2 Second Brain, 3 agent self-learning, 4 NIVO base knowledge. */
export const OFFICE_CARD_SOURCE_LAYERS = [1, 2, 3, 4] as const

/** One source the turn actually used: its data layer, what kind of record, the record and how it reads. */
export interface OfficeCardSource {
    /** 1 MCP live data, 2 Second Brain, 3 agent self-learning, 4 NIVO base knowledge. */
    readonly layer: (typeof OFFICE_CARD_SOURCE_LAYERS)[number]
    /** The kind of record, e.g. mcp_tool, brain_document, brain_fact, brain_lesson, base_document. */
    readonly kind: string
    /** The record: a tool name, a document or fact id. */
    readonly ref: string
    /** What the reader sees, e.g. "HAKUEN rooms.searchAvailability" or "HAKUEN_Brand_Guideline.pdf". */
    readonly label: string
    /** Where it opens, when it does. */
    readonly href?: string
}

/** The decision a card's actions act on. */
export interface OfficeCardRef {
    /** An execution (approval) or a work item (exception). */
    readonly kind: "execution" | "work_item"
    /** Its id. */
    readonly id: string
}

/** The result card payload, version 1 (see be/docs/guides/hub-rooms-and-cards.md). */
export interface OfficeCard {
    /** Always 1. */
    readonly v: 1
    /** The card type. */
    readonly type: OfficeCardType
    /** The headline. */
    readonly title: string
    /** The line under the headline. */
    readonly subtitle?: string
    /** The short status word at the top right. */
    readonly badge?: string
    /** Long text: a caption, a reason, a report. */
    readonly body?: string
    /** Labelled rows. */
    readonly fields?: ReadonlyArray<OfficeCardField>
    /** Images and videos. */
    readonly media?: ReadonlyArray<OfficeCardMedia>
    /** Timed or bulleted lines. */
    readonly lines?: ReadonlyArray<OfficeCardLine>
    /** The link at the foot. */
    readonly link?: OfficeCardLink
    /** The decision the actions act on. */
    readonly ref?: OfficeCardRef
    /** The actions offered; only with a ref. */
    readonly actions?: ReadonlyArray<OfficeCardAction>
    /** The sources the agent used, drawn as the card's "Sources" list. */
    readonly sources?: ReadonlyArray<OfficeCardSource>
    /** Type-specific data the Hub does not draw. */
    readonly data?: Readonly<Record<string, unknown>>
}

/** What reading a payload produced: the card, or why it is not one. */
export type OfficeCardParse =
    | { readonly ok: true; readonly card: OfficeCard }
    | { readonly ok: false; readonly reason: string }

/** One result card line to post. */
export interface OfficeCardPost {
    /** The room; null lets the database route it (origin room of the command, the agent's home room, the department room). */
    readonly room: OptionalRoom
    /** The speaking agent; null for a NIVO line. */
    readonly agentId: string | null
    /** The author shown. */
    readonly authorName: string
    /** The one-line preview, never empty. */
    readonly body: string
    /** The customer it is about. */
    readonly leadId: string | null
    /** The work item it belongs to. */
    readonly workItemId: string | null
    /** The payload, validated before it is stored. */
    readonly card: unknown
}

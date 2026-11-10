/** Client-safe shapes of the NIVO guide conversation. */

/** A button of a guide reply that opens a page of the map. */
export interface GuideLink {
    readonly pageId: string
    readonly label: string
    readonly href: string
    /** The `data-guide-id` element highlighted after the jump. */
    readonly target?: string
}

/** One answer of the guide. */
export interface GuideReply {
    readonly answer: string
    /** Short how-to steps (already in the reader's language). */
    readonly steps: ReadonlyArray<string>
    readonly links: ReadonlyArray<GuideLink>
    /** map: answered from the site map (no tokens); ai: written by the model; busy: the model could not answer. */
    readonly source: "map" | "ai" | "busy"
}

/** One earlier turn of the conversation, as the model sees it. */
export interface GuideTurn {
    readonly role: "user" | "guide"
    readonly text: string
}

/** The words of the guide in the reader's language: the map's text and the fixed lines of its answers. */
export interface GuideText {
    readonly title: (pageId: string) => string
    readonly what: (pageId: string) => string
    readonly steps: (pageId: string) => ReadonlyArray<string>
    readonly keywords: (pageId: string) => ReadonlyArray<string>
    readonly empty: string
    readonly managerOnly: (title: string) => string
    readonly busy: string
    readonly open: (title: string) => string
}

/** The four groups of the search results, in the order they are drawn: where to go, what to do now, what was found, how to. */
export type GuideGroup = "go" | "do" | "found" | "guide"

/** What an entry is, for its mark: a page, a tab of a page, an action, a guide, or a thing of the workspace. */
export type GuideKind =
    | "route"
    | "tab"
    | "action"
    | "guide"
    | "agent"
    | "connection"
    | "lead"
    | "order"
    | "document"
    | "fact"

/** One entry of the static index: a place or an action of the console, its words live in the `guideIndex` catalog under its id. */
export interface GuideEntry {
    /** Unique; a dotted id reads its words from the catalog key with dashes. */
    readonly id: string
    readonly group: "go" | "do"
    readonly kind: "route" | "tab" | "action"
    /** The path inside the workspace, with the query that opens the tab or the wizard. */
    readonly href: string
    /** The `data-guide-id` of the element spotlighted after the jump. */
    readonly target?: string
    /** Never offered to staff. */
    readonly managerOnly?: boolean
}

/** A searchable document: an entry with its words, or a thing of the workspace the drawer loaded. */
export interface GuideDoc {
    readonly id: string
    readonly group: GuideGroup
    readonly kind: GuideKind
    readonly title: string
    /** The muted line under the title. */
    readonly hint: string
    readonly keywords: ReadonlyArray<string>
    readonly href: string
    readonly target?: string
}

/** One result of a search. */
export interface GuideHit {
    readonly doc: GuideDoc
    readonly score: number
}

/** The results of a search, by group; a group with no hit is absent. */
export type GuideResults = Readonly<Partial<Record<GuideGroup, ReadonlyArray<GuideHit>>>>

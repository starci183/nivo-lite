/** Client-safe shapes of the NIVO guide conversation. */

/** A button of a guide reply that opens a page of the map. */
export interface GuideLink {
    readonly pageId: string
    readonly label: string
    readonly href: string
    /** The `data-guide` element highlighted after the jump. */
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

/** One line of the prompt the guide sends to the be text door. */
export interface GuideMessage {
    readonly role: "system" | "user"
    readonly content: string
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
    readonly systemLines: (isManager: boolean) => ReadonlyArray<string>
    readonly replyFormat: string
}

import type { ScriptScene } from "./video-script.policy"

/** A script another agent (AI Marketing) delegated to AI Editor, as the render_script command carries it. */
export interface DelegatedScript {
    /** The video title. */
    readonly title: string
    /** The scenes to render. */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** The channels the video is meant for. */
    readonly channels: ReadonlyArray<string>
    /** The module that delegated. */
    readonly source: string
    /** The output shape. */
    readonly aspect: string
    /** The business goal. */
    readonly goal: string
    /** The planned length. */
    readonly targetSeconds: number
    /** The AI Marketing draft it belongs to, or null. */
    readonly contentItemId: string | null
}

/** A finished delegated render, with its playback links, as the cards show it. */
export interface ReadyVideo {
    /** The delegation. */
    readonly delegationId: string
    /** The project. */
    readonly projectId: string
    /** The render. */
    readonly renderId: string
    /** The title. */
    readonly title: string
    /** The output shape. */
    readonly aspect: string
    /** The rendered scenes. */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** The length in milliseconds, or null. */
    readonly durationMs: number | null
    /** The target channels. */
    readonly channels: ReadonlyArray<string>
    /** The delegating module. */
    readonly source: string
    /** The signed MP4 link. */
    readonly videoUrl: string
    /** The signed poster link, or null. */
    readonly posterUrl: string | null
    /** The signed WebVTT link, or null when the render has no captions file. */
    readonly captionsUrl: string | null
    /** The captions language, or null. */
    readonly captionsLang: string | null
    /** Where the project opens in the app. */
    readonly href: string
}

/** The words of the cards, already in the room's language. */
export interface EditorLabels {
    /** The length label. */
    readonly length: string
    /** The length, e.g. 15 seconds. */
    readonly seconds: string
    /** The aspect label. */
    readonly aspect: string
    /** The captions label. */
    readonly captions: string
    /** Captions present. */
    readonly captionsOn: string
    /** Captions absent. */
    readonly captionsOff: string
    /** The voice label. */
    readonly voice: string
    /** How the voice went (AI voice, captions only, none). */
    readonly voiceValue: string
    /** The channels label. */
    readonly channels: string
    /** No channel chosen. */
    readonly noChannels: string
    /** The poster caption. */
    readonly poster: string
    /** The project link label. */
    readonly link: string
    /** The brand frame label. */
    readonly frame: string
    /** The brand frame applied. */
    readonly frameOn: string
    /** The card text that says who decides. */
    readonly approvalBody: string
    /** The badge of a card waiting for a decision. */
    readonly approvalBadge: string
}

/** A label/value row of a card. */
export interface EditorCardField {
    /** The label. */
    readonly label: string
    /** The value. */
    readonly value: string
}

/** A picture or clip of a card. */
export interface EditorCardMedia {
    /** Image or video. */
    readonly kind: "image" | "video"
    /** Its link. */
    readonly url: string
    /** Its caption. */
    readonly caption: string
}

/** A timed line of a card. */
export interface EditorCardLine {
    /** The time mark. */
    readonly at: string
    /** The text. */
    readonly text: string
}

/** Where a card's link opens. */
export interface EditorCardLink {
    /** The label. */
    readonly label: string
    /** The app-relative or https address. */
    readonly href: string
}

/** The decision a card's buttons act on: a work item waiting for a person. */
export interface EditorCardRef {
    /** Always a work item. */
    readonly kind: "work_item"
    /** The work item. */
    readonly id: string
}

/** A Hub result card, version 1 of the Hub cards contract (the fields AI Editor uses). */
export interface EditorCard {
    /** Always 1. */
    readonly v: 1
    /** The card type. */
    readonly type: "video_ready"
    /** The title. */
    readonly title: string
    /** The subtitle. */
    readonly subtitle?: string
    /** The status word. */
    readonly badge?: string
    /** The long text. */
    readonly body?: string
    /** Label/value rows. */
    readonly fields?: ReadonlyArray<EditorCardField>
    /** Pictures and clips. */
    readonly media?: ReadonlyArray<EditorCardMedia>
    /** Timed lines. */
    readonly lines?: ReadonlyArray<EditorCardLine>
    /** The link. */
    readonly link?: EditorCardLink
    /** The decision the actions act on. */
    readonly ref?: EditorCardRef
    /** The buttons. */
    readonly actions?: ReadonlyArray<"approve" | "decline">
    /** Opaque type data. */
    readonly data?: Readonly<Record<string, unknown>>
}

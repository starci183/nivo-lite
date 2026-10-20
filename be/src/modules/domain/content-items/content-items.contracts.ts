/** One post as the content automations read it. */
export interface DueItem {
    /** The post. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** Its status: idea, draft, waiting_approval, approved, published or skipped. */
    readonly status: string
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** When it is due, as an ISO instant. */
    readonly scheduledAt: string | null
    /** Its content theme. */
    readonly pillarId: string | null
}

/** The idea of a post about an offer. */
export interface OfferIdea {
    /** The workspace. */
    readonly workspaceId: string
    /** The title of the post. */
    readonly title: string
    /** What the post is about. */
    readonly brief: string
    /** The content theme, or null. */
    readonly pillarId: string | null
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** The evidence lines as JSON text. */
    readonly evidence: string
}

/** One channel draft of an agent-written post. */
export interface AgentDraftVariant {
    /** The post text. */
    readonly text: string
    /** The hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The channel note. */
    readonly note: string
}

/** A post an agent drafted, stored as a `draft` with its images. */
export interface AgentDraft {
    /** The workspace. */
    readonly workspaceId: string
    /** The title. */
    readonly title: string
    /** The brief (the request and the video script). */
    readonly brief: string
    /** The channels. */
    readonly channels: ReadonlyArray<string>
    /** When it should be published, ISO 8601. */
    readonly scheduledAt: string
    /** The draft of each channel. */
    readonly variants: Readonly<Record<string, AgentDraftVariant>>
    /** The hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The image paths in the media bucket. */
    readonly imagePaths: ReadonlyArray<string>
    /** Who asked. */
    readonly actor: string
    /** The first history line. */
    readonly evidenceText: string
    /** The instant of the history line, ISO 8601. */
    readonly at: string
}

/** The stored draft: its id and the snapshot its submission is checked against. */
export interface AgentDraftRef {
    /** The content item. */
    readonly id: string
    /** The stored variants. */
    readonly variants: Readonly<Record<string, AgentDraftVariant>>
    /** The stored channels. */
    readonly channels: ReadonlyArray<string>
}

/** An approved post as the scheduler reads it. */
export interface ScheduleView {
    /** The content item. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The channels. */
    readonly channels: ReadonlyArray<string>
    /** The text of each channel. */
    readonly texts: Readonly<Record<string, string>>
    /** The attached media paths. */
    readonly mediaPaths: ReadonlyArray<string>
    /** When it should be published, ISO 8601, or null. */
    readonly scheduledAt: string | null
}

/** Where one network scheduled a post. */
export interface ScheduledMark {
    /** The provider reference. */
    readonly ref: string
    /** When the network publishes it, ISO 8601. */
    readonly scheduled_at: string
}

/** A post for the scheduler, or null when it is gone. */
export type OptionalScheduleView = ScheduleView | null

/** Where one channel scheduled a post. */
export interface ScheduledChannelMark {
    /** The channel. */
    readonly channel: string
    /** The provider reference. */
    readonly ref: string
    /** When the network publishes it, ISO 8601. */
    readonly scheduledAt: string
}

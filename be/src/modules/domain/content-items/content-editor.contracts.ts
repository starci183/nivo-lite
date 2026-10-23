/** One channel-specific draft. */
export interface ContentVariant {
    /** The draft or history text. */
    readonly text: string
    /** The selected hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The channel-specific writing note. */
    readonly note: string
}

/** An attachment selected for a post. */
export interface ContentMediaRef {
    /** The attachment or history entry kind. */
    readonly kind: string
    /** The human-readable display name. */
    readonly name: string
    /** The workspace-owned storage path, when present. */
    readonly path?: string | undefined
    /** The stored row identifier. */
    readonly id?: string | undefined
    /** Whether the attachment was suggested automatically. */
    readonly suggested?: boolean
}

/** A supporting link. */
export interface ContentLink {
    /** The supporting or published URL. */
    readonly url: string
    /** The human-readable link label. */
    readonly label: string
}

/** A bounded history line. */
export interface ContentEvidence {
    /** The recorded instant. */
    readonly at: string
    /** The attachment or history entry kind. */
    readonly kind: string
    /** The recorded actor. */
    readonly by: string
    /** The draft or history text. */
    readonly text: string
}

/** Proof that one channel was posted manually. */
export interface PublishMark {
    /** The recorded instant. */
    readonly at: string
    /** The recorded actor. */
    readonly by: string
    /** The supporting or published URL. */
    readonly url: string
    /** How publication was confirmed. */
    readonly how: string
}

/** A complete content item owned by the content-items capability. */
export interface ContentItem {
    /** The stored row identifier. */
    readonly id: string
    /** The workspace that owns this content. */
    readonly workspaceId: string
    /** The originating editorial plan, when any. */
    readonly planId: string | null
    /** The post title. */
    readonly title: string
    /** The writing brief. */
    readonly brief: string
    /** The content theme, when assigned. */
    readonly pillarId: string | null
    /** The channels selected for publication. */
    readonly channels: ReadonlyArray<string>
    /** The scheduled publication instant, when set. */
    readonly scheduledAt: string | null
    /** The current editorial lifecycle state. */
    readonly status: string
    /** The channel-specific draft texts. */
    readonly variants: Readonly<Record<string, ContentVariant>>
    /** The selected hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The selected image and video attachments. */
    readonly media: ReadonlyArray<ContentMediaRef>
    /** The supporting links. */
    readonly links: ReadonlyArray<ContentLink>
    /** The calendar occasion, when selected. */
    readonly holidayKey: string | null
    /** The bounded editorial history. */
    readonly evidence: ReadonlyArray<ContentEvidence>
    /** Publication evidence indexed by channel. */
    readonly published: Readonly<Record<string, PublishMark>>
    /** The associated approval decision, when any. */
    readonly workItemId: string | null
    /** The first draft instant, when any. */
    readonly draftedAt: string | null
    /** The approving actor, when any. */
    readonly approvedBy: string | null
    /** The approval instant, when any. */
    readonly approvedAt: string | null
    /** The publication instant, when any. */
    readonly publishedAt: string | null
    /** The source that created the idea. */
    readonly source: string
    /** The actor that created the post. */
    readonly createdBy: string
    /** The creation instant. */
    readonly createdAt: string
    /** The most recent update instant. */
    readonly updatedAt: string
}

/** The caller's content permissions and audit name. */
export interface ContentActor {
    /** The workspace that owns this content. */
    readonly workspaceId: string
    /** The human-readable display name. */
    readonly name: string
    /** Whether the caller may manage content. */
    readonly canManage: boolean
}

/** A calendar window; the upper bound is exclusive. */
export interface ContentRange {
    /** The inclusive lower calendar bound. */
    readonly from?: string | undefined
    /** The exclusive upper calendar bound. */
    readonly to?: string | undefined
}

/** Fields accepted when creating an idea. */
export interface CreateContentItem {
    /** The post title. */
    readonly title: string
    /** The channels selected for publication. */
    readonly channels: ReadonlyArray<string>
    /** The scheduled publication instant, when set. */
    readonly scheduledAt?: string | null | undefined
    /** The content theme, when assigned. */
    readonly pillarId?: string | null | undefined
}

/** Editable fields; undefined leaves a field untouched, null clears nullable fields. */
export interface SaveContentItem extends Partial<Pick<CreateContentItem, "scheduledAt" | "pillarId">> {
    /** The post title. */
    readonly title?: string | undefined
    /** The channels selected for publication. */
    readonly channels?: ReadonlyArray<string> | undefined
    /** The writing brief. */
    readonly brief?: string | undefined
    /** The channel-specific draft texts. */
    readonly variants?: Readonly<Record<string, ContentVariant>> | undefined
    /** The selected hashtags. */
    readonly hashtags?: ReadonlyArray<string> | undefined
    /** The supporting links. */
    readonly links?: ReadonlyArray<ContentLink> | undefined
    /** The selected image and video attachments. */
    readonly media?: ReadonlyArray<ContentMediaRef> | undefined
}

/** The four workbench figures. */
export interface ContentFigures {
    /** The number of posts awaiting approval. */
    readonly awaitingApproval: number
    /** The number of posts published in the last thirty days. */
    readonly published30: number
    /** The next approved scheduled post, when any. */
    readonly next: ContentNextPost | null
    /** Theme coverage for the current Vietnam calendar month. */
    readonly pillars: ContentPillarCoverage
}

/** The last completed editorial plan. */
export interface ContentLastPlan {
    /** The editorial plan month. */
    readonly month: string
    /** The number of planned ideas. */
    readonly ideas: number
    /** The AI planning duration in milliseconds, when recorded. */
    readonly ms: number | null
    /** The creation instant. */
    readonly createdAt: string
}

/** Core workbench data; configuration and media have their own queries. */
export interface ContentWorkbench {
    /** The current clock instant. */
    readonly nowIso: string
    /** The workspace that owns this content. */
    readonly workspaceId: string
    /** Whether the caller may manage content. */
    readonly canManage: boolean
    /** The caller's content permissions and audit name. */
    readonly actor: ContentActor
    /** The bounded list of workspace posts. */
    readonly items: ReadonlyArray<ContentItem>
    /** The latest completed editorial plan, when any. */
    readonly lastPlan: ContentLastPlan | null
    /** The workbench summary counts. */
    readonly figures: ContentFigures
}

/** Supported social channels. */
export const CONTENT_CHANNELS: ReadonlyArray<string> = ["facebook", "zalo", "tiktok", "instagram"]

/** The identifier of a content item after a lifecycle change. */
export interface ContentItemReference {
    /** The content item identifier. */
    readonly id: string
}

/** The next approved post on the publication calendar. */
export interface ContentNextPost {
    /** The scheduled publication instant. */
    readonly at: string
    /** The post title. */
    readonly title: string
}

/** The current month's coverage across active content themes. */
export interface ContentPillarCoverage {
    /** The active themes represented by scheduled posts. */
    readonly covered: number
    /** The total number of active themes. */
    readonly total: number
}

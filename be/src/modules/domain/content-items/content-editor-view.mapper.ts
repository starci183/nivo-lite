import type {
    ContentEvidence,
    ContentItem,
    ContentLink,
    ContentMediaRef,
    ContentRange,
    ContentVariant,
    PublishMark,
} from "./content-editor.contracts"

/** One channel's draft in a typed collection. */
interface ContentVariantView extends Omit<ContentVariant, "hashtags"> {
    /** The social channel. */
    readonly channel: string
    /** The channel-specific hashtags. */
    readonly hashtags: Array<string>
}

/** Publication proof in a typed collection. */
interface ContentPublishedView extends PublishMark {
    /** The social channel. */
    readonly channel: string
}

/** Attachment properties with explicit defaults. */
interface ContentMediaView {
    /** The attachment kind. */
    readonly kind: string
    /** The display name. */
    readonly name: string
    /** The media object's path. */
    readonly path: string | null
    /** The rendered video id. */
    readonly id: string | null
    /** Whether AI suggested the attachment. */
    readonly suggested: boolean
}

/** Nullable scheduling bounds from the application boundary. */
interface ContentRangeInput {
    /** Inclusive lower bound, ISO 8601. */
    readonly from?: string | null
    /** Exclusive upper bound, ISO 8601. */
    readonly to?: string | null
}

/** A bounded or absent calendar selection. */
type ContentRangeBoundary = ContentRangeInput | null | undefined
/** A normalized calendar range, when either bound was selected. */
type ContentSelectedRange = ContentRange | undefined

const variantViews = (variants: Readonly<Record<string, ContentVariant>>): Array<ContentVariantView> =>
    Object.entries(variants).map(([channel, variant]) => ({ channel, ...variant, hashtags: [...variant.hashtags] }))

const publishedViews = (published: Readonly<Record<string, PublishMark>>): Array<ContentPublishedView> =>
    Object.entries(published).map(([channel, mark]) => ({ channel, ...mark }))

const mediaViews = (media: ReadonlyArray<ContentMediaRef>): Array<ContentMediaView> =>
    media.map((entry) => ({
        ...entry,
        path: entry.path ?? null,
        id: entry.id ?? null,
        suggested: entry.suggested ?? false,
    }))

/** A pure editor read model with channel collections and explicit attachment defaults. */
export class ContentItemViewMapper {
    /** The id of the content item. */
    readonly id!: string

    /** The workspace id of the content item. */
    readonly workspaceId!: string

    /** The plan id of the content item. */
    readonly planId!: string | null

    /** The title of the content item. */
    readonly title!: string

    /** The brief of the content item. */
    readonly brief!: string

    /** The pillar id of the content item. */
    readonly pillarId!: string | null

    /** The channels of the content item. */
    readonly channels!: Array<string>

    /** The scheduled at of the content item. */
    readonly scheduledAt!: string | null

    /** The status of the content item. */
    readonly status!: string

    /** The variants of the content item. */
    readonly variants!: Array<ContentVariantView>

    /** The hashtags of the content item. */
    readonly hashtags!: Array<string>

    /** The media of the content item. */
    readonly media!: Array<ContentMediaView>

    /** The links of the content item. */
    readonly links!: Array<ContentLink>

    /** The holiday key of the content item. */
    readonly holidayKey!: string | null

    /** The evidence of the content item. */
    readonly evidence!: Array<ContentEvidence>

    /** The published of the content item. */
    readonly published!: Array<ContentPublishedView>

    /** The work item id of the content item. */
    readonly workItemId!: string | null

    /** The drafted at of the content item. */
    readonly draftedAt!: string | null

    /** The approved by of the content item. */
    readonly approvedBy!: string | null

    /** The approved at of the content item. */
    readonly approvedAt!: string | null

    /** The published at of the content item. */
    readonly publishedAt!: string | null

    /** The source of the content item. */
    readonly source!: string

    /** The created by of the content item. */
    readonly createdBy!: string

    /** The created at of the content item. */
    readonly createdAt!: string

    /** The updated at of the content item. */
    readonly updatedAt!: string

    constructor(item: ContentItem) {
        Object.assign(this, item, {
            channels: [...item.channels],
            variants: variantViews(item.variants),
            hashtags: [...item.hashtags],
            media: mediaViews(item.media),
            links: item.links.map((link) => ({ ...link })),
            evidence: item.evidence.map((line) => ({ ...line })),
            published: publishedViews(item.published),
        })
    }
}

/** A pure scheduling selection that treats nullable omitted bounds as an unbounded read. */
export class ContentRangeSelectionMapper {
    /** The normalized scheduling range. */
    readonly range: ContentSelectedRange

    constructor(input: ContentRangeBoundary) {
        const from = input?.from ?? undefined
        const to = input?.to ?? undefined
        this.range = from === undefined && to === undefined ? undefined : { from, to }
    }
}

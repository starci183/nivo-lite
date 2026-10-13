import type { ContentLink, ContentVariant, SaveContentItem } from "./content-editor.contracts"

/** Nullable transport values before they become an editor patch. */
interface ContentPatchInput {
    /** The replacement title, when selected. */
    readonly title?: string | null
    /** The replacement channel selection. */
    readonly channels?: ReadonlyArray<string> | null
    /** The replacement schedule; null clears it. */
    readonly scheduledAt?: string | null
    /** The replacement content theme; null clears it. */
    readonly pillarId?: string | null
    /** The replacement brief. */
    readonly brief?: string | null
    /** The replacement texts selected by channel. */
    readonly variants?: ReadonlyArray<ContentVariant & { readonly channel: string }> | null
    /** The replacement shared hashtags. */
    readonly hashtags?: ReadonlyArray<string> | null
    /** The replacement supporting links. */
    readonly links?: ReadonlyArray<ContentLink> | null
    /** The replacement media attachments. */
    readonly media?: ReadonlyArray<{
        /** The attachment kind. */
        readonly kind: string
        /** The display name of the attachment. */
        readonly name: string
        /** The workspace file path of a media attachment. */
        readonly path?: string | null
        /** The completed render id of a video attachment. */
        readonly id?: string | null
        /** Whether the attachment was suggested by AI. */
        readonly suggested?: boolean | null
    }> | null
}

/** Treats nullable optional editor fields as omitted; null still clears a schedule or pillar. */
const normalizeContentPatch = (input: ContentPatchInput): SaveContentItem => ({
    title: input.title ?? undefined,
    channels: input.channels ?? undefined,
    scheduledAt: input.scheduledAt,
    pillarId: input.pillarId,
    brief: input.brief ?? undefined,
    variants:
        input.variants == null
            ? undefined
            : Object.fromEntries(
                  input.variants.map(({ channel, text, hashtags, note }) => [channel, { text, hashtags, note }]),
              ),
    hashtags: input.hashtags ?? undefined,
    links: input.links ?? undefined,
    media: input.media?.map((media) => ({
        kind: media.kind,
        name: media.name,
        path: media.kind === "media" ? (media.path ?? undefined) : undefined,
        id: media.kind === "video_render" ? (media.id ?? undefined) : undefined,
        suggested: media.suggested ?? false,
    })),
})

/** Pure selection of editable fields with nullable transport values normalized for the domain. */
export class ContentPatchSelectionMapper {
    /** The whitelisted editor patch; null only clears nullable scheduling fields. */
    readonly patch: SaveContentItem

    constructor(input: ContentPatchInput) {
        this.patch = normalizeContentPatch(input)
    }
}

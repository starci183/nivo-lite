import { isWorkspaceMediaPath } from "@modules/domain/content-media"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import { CONTENT_CHANNELS } from "./content-editor.contracts"
import type { ContentItem, ContentVariant, SaveContentItem } from "./content-editor.contracts"

/** Rejects invalid editor data using a localized domain failure. */
export const requireContentInput = (condition: boolean): void => {
    if (!condition) throw new ContentItemsError({ code: ContentItemsErrorCode.InvalidInput })
}

/** Canonical, bounded hashtags without duplicate or empty entries. */
export const contentHashtags = (values: ReadonlyArray<string>): Array<string> =>
    [...new Set(values.map((value) => value.trim().replace(/^#+/, "").replace(/\s+/g, "")).filter(Boolean))]
        .slice(0, 30)
        .map((value) => value.slice(0, 80))

/** Refuses unsupported channels instead of silently changing the target audience. */
export const contentChannels = (values: ReadonlyArray<string>): Array<string> => {
    requireContentInput(
        values.length > 0 &&
            values.length <= CONTENT_CHANNELS.length &&
            values.every((value) => CONTENT_CHANNELS.includes(value)),
    )
    return [...new Set(values)]
}

/** Normalizes the bounded per-channel texts. */
export const contentVariants = (values: Readonly<Record<string, ContentVariant>>): Record<string, ContentVariant> => {
    requireContentInput(Object.keys(values).every((key) => CONTENT_CHANNELS.includes(key)))
    return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
            key,
            {
                text: value.text.slice(0, 6000),
                hashtags: contentHashtags(value.hashtags),
                note: value.note.slice(0, 600),
            },
        ]),
    )
}

/** A post with any channel text can be restored to draft. */
export const contentHasText = (item: Pick<ContentItem, "variants">): boolean =>
    Object.values(item.variants).some((variant) => variant.text.trim() !== "")

/** The next state of a permitted user transition. */
export const contentTransition = (item: ContentItem, kind: string): string => {
    if (kind === "skip" && ["idea", "draft", "approved"].includes(item.status)) return "skipped"
    if (kind === "restore" && item.status === "skipped") return contentHasText(item) ? "draft" : "idea"
    if (kind === "reopen" && item.status === "approved") return "draft"
    throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
}

/** Applies text edits only to an open post; a schedule can still move before publication. */
export const mergeContentPatch = (item: ContentItem, patch: SaveContentItem, workspaceId: string): ContentItem => {
    const open = item.status === "idea" || item.status === "draft"
    if (!open) {
        if (patch.scheduledAt === undefined || item.status === "published")
            throw new ContentItemsError({ code: ContentItemsErrorCode.Frozen })
        return { ...item, scheduledAt: patch.scheduledAt }
    }
    if (patch.title !== undefined) requireContentInput(patch.title.trim() !== "")
    if (patch.media !== undefined)
        requireContentInput(
            patch.media.length <= 10 &&
                patch.media.every((media) =>
                    media.kind === "video_render"
                        ? typeof media.id === "string" &&
                          /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(media.id)
                        : media.kind === "media" &&
                          typeof media.path === "string" &&
                          isWorkspaceMediaPath(workspaceId, media.path),
                ),
        )
    const variants = patch.variants === undefined ? item.variants : contentVariants(patch.variants)
    const links = patch.links
        ?.filter((link) => /^https?:\/\//i.test(link.url))
        .slice(0, 10)
        .map((link) => ({ url: link.url.trim(), label: link.label.slice(0, 80) }))
    return {
        ...item,
        title: patch.title?.trim().slice(0, 200) ?? item.title,
        brief: patch.brief?.slice(0, 4000) ?? item.brief,
        pillarId: patch.pillarId === undefined ? item.pillarId : patch.pillarId,
        channels: patch.channels === undefined ? item.channels : contentChannels(patch.channels),
        scheduledAt: patch.scheduledAt === undefined ? item.scheduledAt : patch.scheduledAt,
        variants,
        hashtags: patch.hashtags === undefined ? item.hashtags : contentHashtags(patch.hashtags),
        links: links ?? item.links,
        media: patch.media ?? item.media,
        status: item.status === "idea" && contentHasText({ variants }) ? "draft" : item.status,
    }
}

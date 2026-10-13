import { CONTENT_CHANNELS } from "./content-editor.contracts"
import type {
    ContentEvidence,
    ContentLink,
    ContentMediaRef,
    ContentVariant,
    PublishMark,
} from "./content-editor.contracts"

const recordOf = (value: unknown): object | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : null

const valueOf = (record: object, key: string): unknown => Reflect.get(record, key)
const textOf = (record: object, key: string): string => {
    const value = valueOf(record, key)
    return typeof value === "string" ? value : ""
}
const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

/** One historical jsonb object selected for a supported channel. */
interface ContentChannelObject {
    /** The supported channel key. */
    readonly channel: string
    /** The non-null object saved under the key. */
    readonly value: object
}

const channelObjects = (value: unknown): Array<ContentChannelObject> => {
    const record = recordOf(value)
    if (record === null) return []
    return Object.entries(record).flatMap(([channel, raw]: [string, unknown]) => {
        const object = recordOf(raw)
        return object === null || !CONTENT_CHANNELS.includes(channel) ? [] : [{ channel, value: object }]
    })
}

/** Reads valid channel objects from historical jsonb and fills missing text fields. */
export const readContentVariants = (value: unknown): Record<string, ContentVariant> =>
    Object.fromEntries(
        channelObjects(value).map(({ channel, value: variant }) => [
            channel,
            {
                text: textOf(variant, "text"),
                hashtags: listOf(valueOf(variant, "hashtags")).map(String),
                note: textOf(variant, "note"),
            },
        ]),
    )

/** Reads stored attachments without exposing null or malformed object members. */
export const readContentMedia = (value: unknown): Array<ContentMediaRef> =>
    listOf(value).flatMap((raw) => {
        const media = recordOf(raw)
        if (media === null) return []
        const path = textOf(media, "path")
        const id = textOf(media, "id")
        return [
            {
                kind: valueOf(media, "kind") === "video_render" ? "video_render" : "media",
                name: textOf(media, "name"),
                path: path === "" ? undefined : path,
                id: id === "" ? undefined : id,
                suggested: valueOf(media, "suggested") === true,
            },
        ]
    })

/** Reads stored supporting links with string defaults. */
export const readContentLinks = (value: unknown): Array<ContentLink> =>
    listOf(value).flatMap((raw) => {
        const link = recordOf(raw)
        return link === null ? [] : [{ url: textOf(link, "url"), label: textOf(link, "label") }]
    })

/** Reads historical audit entries while omitting malformed array elements. */
export const readContentEvidence = (value: unknown): Array<ContentEvidence> =>
    listOf(value).flatMap((raw) => {
        const line = recordOf(raw)
        return line === null
            ? []
            : [
                  {
                      at: textOf(line, "at"),
                      kind: textOf(line, "kind"),
                      by: textOf(line, "by"),
                      text: textOf(line, "text"),
                  },
              ]
    })

/** Reads publication proofs only for supported channels. */
export const readContentPublished = (value: unknown): Record<string, PublishMark> =>
    Object.fromEntries(
        channelObjects(value).map(({ channel, value: mark }) => [
            channel,
            {
                at: textOf(mark, "at"),
                by: textOf(mark, "by"),
                url: textOf(mark, "url"),
                how: textOf(mark, "how"),
            },
        ]),
    )

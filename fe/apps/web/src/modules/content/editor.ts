import { z } from "zod"
import type { useTranslations } from "next-intl"
import { cleanHashtags } from "./text"
import { dateText, parseDateText, parseTimeText, timeText, toInstant } from "./time"
import { CONTENT_CHANNELS, emptyVariant } from "./types"
import type { ContentChannel, ContentItem, LinkRef, MediaRef, Variants } from "./types"

type EditorT = ReturnType<typeof useTranslations<"content">>

/** The validation schema of the post editor, with the messages of the content catalog. */
export const editorSchema = (t: EditorT) => {
    const channel = z.enum(["facebook", "zalo", "tiktok", "instagram"])
    const text = (max: number) => z.string().max(max, t("err_input"))
    return z.object({
        title: text(200).trim().min(1, t("err_title_required")),
        brief: text(4000),
        pillarId: z.string().nullable(),
        channels: z.array(channel).min(1, t("err_channels_required")).max(4, t("err_channels_required")),
        date: z.string().refine((value) => value.trim() === "" || parseDateText(value) !== null, t("err_date_invalid")),
        time: z.string().refine((value) => value.trim() === "" || parseTimeText(value) !== null, t("err_time_invalid")),
        hint: text(12000),
        proof: z.partialRecord(
            channel,
            z.object({
                url: z.union([
                    z.literal(""),
                    z.url({ protocol: /^https?$/, error: t("err_url_invalid") }).max(2000, t("err_url_invalid")),
                ]),
                how: text(1000),
            }),
        ),
        variants: z.partialRecord(
            channel,
            z.object({ text: text(6000), hashtags: z.array(text(80)).max(30, t("err_input")), note: text(600) }),
        ),
        tags: z.partialRecord(channel, z.string()),
        media: z
            .array(
                z.object({
                    kind: z.enum(["media", "video_render"]),
                    path: z.string().optional(),
                    id: z.string().optional(),
                    name: z.string(),
                    suggested: z.boolean().optional(),
                }),
            )
            .max(10, t("err_input")),
        links: z
            .array(
                z.object({
                    url: z.union([
                        z.literal(""),
                        z.url({ protocol: /^https?$/, error: t("err_url_invalid") }).max(2048, t("err_url_invalid")),
                    ]),
                    label: text(80),
                }),
            )
            .max(10, t("err_input")),
    })
}

/** The fields managed by the post editor's React Hook Form. */
export type EditorForm = z.input<ReturnType<typeof editorSchema>>

/** The fields a save sends. */
export interface EditorSave {
    readonly title: string
    readonly brief: string
    readonly pillarId: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly scheduledAt: string | null
    readonly variants?: Variants
    readonly links: ReadonlyArray<LinkRef>
    readonly media: ReadonlyArray<MediaRef>
}

/** The editor fields a stored post starts with. */
export const initialForm = (item: ContentItem): EditorForm => ({
    title: item.title,
    brief: item.brief,
    pillarId: item.pillar_id,
    channels: [...item.channels],
    date: dateText(item.scheduled_at),
    time: timeText(item.scheduled_at),
    hint: "",
    proof: {},
    variants: Object.fromEntries(
        Object.entries(item.variants).map(([channel, variant]) => [
            channel,
            { ...variant, hashtags: [...variant.hashtags] },
        ]),
    ),
    tags: Object.fromEntries(
        CONTENT_CHANNELS.map((channel) => [channel, (item.variants[channel]?.hashtags ?? []).join(" ")]),
    ),
    media: item.media.map((media) => ({ ...media })),
    links: item.links.map((link) => ({ ...link })),
})

/** The mutation input of a valid form, or nothing when the date or the time cannot be read. */
export const toEditorSave = (values: EditorForm, withVariants: boolean): EditorSave | undefined => {
    const at = toInstant(values.date, values.time, "19:30")
    if (at === "date_invalid" || at === "time_invalid") return undefined
    const variants = Object.fromEntries(
        values.channels.map((channel) => [
            channel,
            {
                ...(values.variants[channel] ?? emptyVariant()),
                hashtags: cleanHashtags((values.tags[channel] ?? "").split(/\s+/)),
            },
        ]),
    )
    return {
        title: values.title.trim(),
        brief: values.brief,
        pillarId: values.pillarId,
        channels: values.channels,
        scheduledAt: at,
        ...(withVariants ? { variants } : {}),
        links: values.links.filter((link) => link.url.trim() !== ""),
        media: values.media,
    }
}

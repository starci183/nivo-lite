import { useState } from "react"
import {
    CONTENT_CHANNELS,
    cleanHashtags,
    dateText,
    emptyVariant,
    timeText,
    toInstant,
    type ContentChannel,
    type ContentItem,
    type InstantError,
    type LinkRef,
    type MediaRef,
    type Variant,
    type Variants,
} from "@/modules/content"

/** What the editor lets the member change. */
export interface EditorForm {
    readonly title: string
    readonly brief: string
    readonly pillarId: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly date: string
    readonly time: string
    readonly variants: Variants
    /** The hashtag text typed for each channel. */
    readonly tags: Readonly<Partial<Record<ContentChannel, string>>>
    readonly media: ReadonlyArray<MediaRef>
    readonly links: ReadonlyArray<LinkRef>
}

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

/** The form state of the post editor and its edits. */
export interface ContentEditorFormState {
    readonly form: EditorForm
    /** Changes some fields. */
    readonly patch: (change: Partial<EditorForm>) => void
    /** Changes the text, hashtags or note of one channel. */
    readonly setVariant: (channel: ContentChannel, change: Partial<Variant>) => void
    /** Changes the hashtag text of one channel. */
    readonly setTags: (channel: ContentChannel, text: string) => void
    /** The fields to save, or why the typed date or time is refused. Without `withVariants` the channel texts are left out. */
    readonly build: (withVariants: boolean) => EditorSave | InstantError
}

const initialForm = (item: ContentItem): EditorForm => ({
    title: item.title,
    brief: item.brief,
    pillarId: item.pillar_id,
    channels: item.channels,
    date: dateText(item.scheduled_at),
    time: timeText(item.scheduled_at),
    variants: item.variants,
    tags: Object.fromEntries(CONTENT_CHANNELS.map((c) => [c, (item.variants[c]?.hashtags ?? []).join(" ")])),
    media: item.media,
    links: item.links,
})

/** Holds the editable fields of one post. */
export const useContentEditorForm = (item: ContentItem): ContentEditorFormState => {
    const [form, setForm] = useState<EditorForm>(() => initialForm(item))
    const patch = (change: Partial<EditorForm>): void => setForm((cur) => ({ ...cur, ...change }))
    const setVariant = (channel: ContentChannel, change: Partial<Variant>): void =>
        setForm((cur) => ({
            ...cur,
            variants: { ...cur.variants, [channel]: { ...(cur.variants[channel] ?? emptyVariant()), ...change } },
        }))
    const setTags = (channel: ContentChannel, text: string): void =>
        setForm((cur) => ({ ...cur, tags: { ...cur.tags, [channel]: text } }))
    const build = (withVariants: boolean): EditorSave | InstantError => {
        const at = toInstant(form.date, form.time, "19:30")
        if (at === "date_invalid" || at === "time_invalid") return at
        const variants = Object.fromEntries(
            form.channels.map((c) => [
                c,
                { ...(form.variants[c] ?? emptyVariant()), hashtags: cleanHashtags((form.tags[c] ?? "").split(/\s+/)) },
            ]),
        )
        return {
            title: form.title,
            brief: form.brief,
            pillarId: form.pillarId,
            channels: form.channels,
            scheduledAt: at,
            ...(withVariants ? { variants } : {}),
            links: form.links,
            media: form.media,
        }
    }
    return { form, patch, setVariant, setTags, build }
}

import type { BadgeTone } from "@starci/grammar/common"
import {
    CHANNEL_RULES,
    channelLabel,
    channelRule,
    copyReadyText,
    dateText,
    dateTimeText,
    isImagePath,
    timeText,
    type ContentChannel,
    type ContentItem,
    type ContentStatus,
    type EvidenceLine,
    type MediaRef,
    type SignedUrls,
} from "@/modules/content"

export {
    CHANNEL_RULES,
    channelLabel,
    CONTENT_CHANNELS,
    CONTENT_STATUSES,
    channelRule,
    claimWarnings,
    dateText,
    dateTimeText,
    daysInMonth,
    isoWeekdayOf,
    monthKey,
    moveToDay,
    pad2,
    pillarBalance,
    shiftMonth,
    slotsForMonth,
    toInstant,
    vietnamClock,
    vnDateKey,
    warningMessage,
} from "@/modules/content"
export { toContentDraftWarnings } from "@/modules/content"
export type {
    EditorForm,
    ChannelWarning,
    ContentChannel,
    ContentItem,
    ContentStatus,
    ContentWorkbenchData,
    ItemTransition,
    MediaRef,
    Pillar,
    SignedUrls,
} from "@/modules/content"

/** The translator of the content catalog, as the drawings receive it. */
export type ContentT = (key: string, values?: Record<string, string | number>) => string

const STATUS_TONE: Readonly<Record<ContentStatus, BadgeTone>> = {
    idea: "neutral",
    draft: "accent",
    waiting_approval: "warning",
    approved: "success",
    published: "success",
    skipped: "neutral",
}

/** A post ready to draw: every word and format is already resolved. */
export interface PostView {
    readonly id: string
    readonly title: string
    readonly time: string
    readonly when: string
    readonly brief: string | null
    readonly statusLabel: string
    readonly tone: BadgeTone
    readonly isSkipped: boolean
    /** Whether the post can still change date. */
    readonly canMove: boolean
    readonly channels: ReadonlyArray<string>
    readonly pillar: string | null
}

/** Resolves the words and formats of a post for the lists, the agenda and the calendar. */
export const postView = (t: ContentT, item: ContentItem, pillarNames: Readonly<Record<string, string>>): PostView => ({
    id: item.id,
    title: item.title,
    time: timeText(item.scheduled_at),
    when: item.scheduled_at ? `${dateText(item.scheduled_at)} · ${timeText(item.scheduled_at)}` : t("noDate"),
    brief: item.brief === "" ? null : item.brief,
    statusLabel: t(`status_${item.status}`),
    tone: STATUS_TONE[item.status],
    isSkipped: item.status === "skipped",
    canMove: item.status !== "published",
    channels: item.channels.map((c) => channelRule(c).short),
    pillar: item.pillar_id === null ? null : (pillarNames[item.pillar_id] ?? null),
})

/** The channel choices of a form. */
export const channelOptions = (t: ContentT): ReadonlyArray<{ readonly value: string; readonly label: string }> =>
    CHANNEL_RULES.map((rule) => ({ value: rule.key, label: channelLabel(t, rule.key) }))

/** A picture or video of a post ready to draw. */
export interface MediaTile {
    readonly key: string
    readonly name: string
    readonly kind: "image" | "video" | "text"
    readonly url: string | null
    readonly isSuggested: boolean
}

/** Resolves how a media reference is shown. */
export const mediaTile = (media: MediaRef, urls: Readonly<Record<string, SignedUrls>>): MediaTile => {
    const key = media.kind === "video_render" ? `video:${media.id}` : (media.path ?? "")
    const url = urls[key]?.view ?? null
    const shown = media.kind === "video_render" ? "video" : "image"
    const isShowable = url !== null && (media.kind === "video_render" || isImagePath(media.path))
    return { key, name: media.name, kind: isShowable ? shown : "text", url, isSuggested: media.suggested === true }
}

/** A file the member can download to post by hand. */
export interface DownloadFile {
    readonly key: string
    readonly name: string
    readonly url: string
}

/** The downloadable files of a post. */
export const downloadFiles = (
    media: ReadonlyArray<MediaRef>,
    urls: Readonly<Record<string, SignedUrls>>,
): Array<DownloadFile> =>
    media.flatMap((m) => {
        const key = m.kind === "video_render" ? `video:${m.id}` : (m.path ?? "")
        const found = urls[key]
        return found === undefined ? [] : [{ key, name: m.name, url: found.download }]
    })

/** The "post it by hand" step of one channel of an approved post. */
export interface PublishStep {
    readonly channel: ContentChannel
    readonly label: string
    readonly text: string
    /** Who posted it when, and the proof, or null while it is not marked. */
    readonly doneText: string | null
    readonly isZalo: boolean
}

/** The steps of an approved or published post, one per channel. */
export const publishSteps = (t: ContentT, item: ContentItem): Array<PublishStep> =>
    item.channels.map((channel) => {
        const done = item.published[channel]
        const proof = done?.url || done?.how
        return {
            channel,
            label: channelLabel(t, channel),
            text: copyReadyText(item.variants[channel]),
            doneText: done
                ? `${t("postedAt", { when: dateTimeText(done.at), who: done.by })}${proof ? ` · ${t("postedProof", { proof })}` : ""}`
                : null,
            isZalo: channel === "zalo",
        }
    })

/** One line of the history of a post. */
export interface HistoryRow {
    readonly id: string
    readonly text: string
    readonly at: string
    readonly timeLabel: string
}

/** The history of a post, newest first. */
export const historyRows = (evidence: ReadonlyArray<EvidenceLine>): Array<HistoryRow> =>
    [...evidence]
        .reverse()
        .map((e, i) => ({ id: `${e.at}-${i}`, text: e.text, at: e.at, timeLabel: dateTimeText(e.at) }))

/** The text of one channel of a waiting post. */
export interface QuoteView {
    readonly channel: string
    readonly label: string
    readonly text: string
}

/** The text of each channel as it will be posted. */
export const quotes = (t: ContentT, item: ContentItem): Array<QuoteView> =>
    item.channels.map((c) => ({ channel: c, label: channelLabel(t, c), text: copyReadyText(item.variants[c]) }))

/** The writing limits of a channel, for the editor tab. */
export interface ChannelLimits {
    readonly label: string
    readonly maxChars: number
    readonly showTags: boolean
}

/** The limits of a channel. */
export const channelLimits = (t: ContentT, channel: ContentChannel): ChannelLimits => {
    const rule = channelRule(channel)
    return { label: channelLabel(t, channel), maxChars: rule.max_chars, showTags: rule.hashtags.max > 0 }
}

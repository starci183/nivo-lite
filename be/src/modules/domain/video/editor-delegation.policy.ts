import { parseJsonText } from "@modules/platform/primitives"
import { readScript } from "./video-script.policy"
import type { ScriptScene } from "./video-script.policy"
import { ASPECTS } from "./video-spec.policy"
import { workspaceMediaPath } from "./video-workbench.policy"
import type {
    DelegatedScript,
    EditorCard,
    EditorCardField,
    EditorCardLine,
    EditorCardMedia,
    EditorLabels,
    ReadyVideo,
} from "./editor-delegation.contracts"

/** The goals a delegated project may take; anything else is an offer. */
const GOALS: ReadonlySet<string> = new Set(["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"])

/** The channels a delegation may target, with the names the card shows. */
const CHANNEL_NAMES: Readonly<Record<string, string>> = {
    facebook: "Facebook",
    zalo: "Zalo OA",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
}

/** The module that delegates when the command names none: AI Marketing. */
const DEFAULT_SOURCE = "content"

/** Seconds a scene is planned at when the project's target length is estimated. */
const SECONDS_PER_SCENE = 5

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** A JSON text field back to its value; a value that is not JSON text stays as it is. */
const jsonOf = (value: unknown): unknown => {
    if (typeof value !== "string") return value
    const read = parseJsonText(value)
    return read.ok ? read.value : value
}

/** The target channels: a list (or its JSON text) or comma separated text, known names only, each once. */
export const channelsOf = (raw: unknown): Array<string> => {
    const parsed = jsonOf(raw)
    let list: Array<unknown> = []
    if (Array.isArray(parsed)) list = parsed
    else if (typeof parsed === "string") list = parsed.split(",")
    const known = list.map((entry) => textOf(entry).toLowerCase()).filter((entry) => entry in CHANNEL_NAMES)
    return [...new Set(known)]
}

/** The scenes of a delegated script: the stored script's rules, and a media path outside the workspace becomes a colour card. */
const scenesOf = (raw: unknown, workspaceId: string): Array<ScriptScene> =>
    readScript(jsonOf(raw)).map((scene) =>
        scene.media === null || workspaceMediaPath(scene.media, workspaceId) ? scene : { ...scene, media: null },
    )

/**
 * The script another agent delegated, read from the command's proposal fields; null when it cannot be rendered (no title, no usable
 * scene, or a brand kit of another workspace: the brand kit is one per workspace, so its id is the workspace id).
 */
export const readDelegation = (
    fields: Readonly<Record<string, unknown>>,
    workspaceId: string,
): DelegatedScript | null => {
    const title = textOf(fields.title).slice(0, 120)
    const scenes = scenesOf(fields.script, workspaceId)
    const brandKit = textOf(fields.brand_kit_id)
    if (title === "" || scenes.length === 0 || (brandKit !== "" && brandKit !== workspaceId)) return null
    const goal = textOf(fields.goal)
    const contentItem = textOf(fields.content_item_id)
    return {
        title,
        scenes,
        channels: channelsOf(fields.channels),
        source: textOf(fields.source) || DEFAULT_SOURCE,
        aspect: ASPECTS.find((candidate) => candidate === textOf(fields.aspect)) ?? "9:16",
        goal: GOALS.has(goal) ? goal : "offer",
        targetSeconds: Math.min(90, Math.max(10, scenes.length * SECONDS_PER_SCENE)),
        contentItemId: UUID.test(contentItem) ? contentItem : null,
    }
}

/** The channel names a card shows, joined; empty when no channel was chosen. */
export const channelNames = (channels: ReadonlyArray<string>): string =>
    channels.map((channel) => CHANNEL_NAMES[channel] ?? channel).join(" + ")

/** A time span in whole seconds, such as 00 to 05s with an en dash. */
const mark = (from: number, to: number): string =>
    `${String(Math.round(from)).padStart(2, "0")}\u2013${String(Math.round(to)).padStart(2, "0")}s`

/** One line per scene with its share of the video's length and its on-screen words (or its spoken words when it has none). */
export const sceneLines = (scenes: ReadonlyArray<ScriptScene>, seconds: number): Array<EditorCardLine> => {
    const each = scenes.length === 0 ? 0 : seconds / scenes.length
    return scenes.slice(0, 20).map((scene, index) => ({
        at: mark(index * each, (index + 1) * each),
        text: scene.caption === "" ? scene.voiceover : scene.caption,
    }))
}

/** The whole seconds of a render, at least one. */
export const secondsOf = (durationMs: number | null): number => Math.max(1, Math.round((durationMs ?? 0) / 1000))

/**
 * The `video_ready` card (Hub cards v1) AI Editor posts in the Marketing room when a delegated render is done. It carries the
 * publish_video work item as its decision, so the card's own approve and decline buttons decide it.
 */
export const videoReadyCard = (video: ReadyVideo, labels: EditorLabels, approvalItemId: string): EditorCard => {
    const seconds = secondsOf(video.durationMs)
    const channels = channelNames(video.channels)
    const fields: Array<EditorCardField> = [
        { label: labels.length, value: labels.seconds },
        { label: labels.aspect, value: video.aspect },
        { label: labels.captions, value: video.captionsUrl === null ? labels.captionsOff : labels.captionsOn },
        { label: labels.voice, value: labels.voiceValue },
        { label: labels.frame, value: labels.frameOn },
        { label: labels.channels, value: channels === "" ? labels.noChannels : channels },
    ]
    const media: Array<EditorCardMedia> = [
        { kind: "video", url: video.videoUrl, caption: `${labels.seconds} \u00b7 ${video.aspect}` },
    ]
    if (video.posterUrl !== null) media.push({ kind: "image", url: video.posterUrl, caption: labels.poster })
    return {
        v: 1,
        type: "video_ready",
        title: video.title,
        subtitle: [labels.seconds, video.aspect, channels].filter((part) => part !== "").join(" \u00b7 "),
        badge: labels.approvalBadge,
        body: labels.approvalBody,
        fields,
        media,
        lines: sceneLines(video.scenes, seconds),
        link: { label: labels.link, href: video.href },
        ref: { kind: "work_item", id: approvalItemId },
        actions: ["approve", "decline"],
        data: {
            delegation_id: video.delegationId,
            project_id: video.projectId,
            render_id: video.renderId,
            source: video.source,
            channels: [...video.channels],
            video_url: video.videoUrl,
            poster_url: video.posterUrl,
            captions_url: video.captionsUrl,
            captions_lang: video.captionsLang,
            sources: [
                { layer: 2, source: "video_brand_kits" },
                { layer: 2, source: `delegated_script:${video.source}` },
            ],
        },
    }
}

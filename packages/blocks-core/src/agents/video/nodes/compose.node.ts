import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { COMPOSE_RESOLUTION_NAMES, composeSpecOf } from "../rules/compose"
import type { ScriptScene } from "../rules/script"
import type { VideoAspect } from "../rules/spec"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, textOrNull, valueOrCannot, viaAccount } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"
import { SCENES_MAX, type Shot, aspectSchema, memberOf, sceneSchema, shotSchema } from "./video.shapes"

/** The longest provider key and render id a compose answer carries. */
const PROVIDER_MAX = 40

/** What the one composed video is made from. */
export interface VideoComposeInput {
    /** The render record that keeps the making. */
    readonly renderId: string
    /** The signed address of each stored clip, in scene order. */
    readonly clips: ReadonlyArray<{ readonly fileUrl: string }>
    /** The signed address of the narration, or null for none. */
    readonly voiceUrl: string | null
    /** The clips as they were asked of the video provider (their lengths). */
    readonly shots: ReadonlyArray<Shot>
    /** The script's scenes (their headings become the captions). */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** The shape of the finished video. */
    readonly aspect: VideoAspect
    /** The resolution of the composed video. */
    readonly resolution: (typeof COMPOSE_RESOLUTION_NAMES)[number]
}

/** The input as a graph binds it: the resolution may be absent (the graph's own, `hd`). */
export interface VideoComposeGiven {
    /** The render the clips belong to. */
    readonly renderId: string
    /** The rendered clips, in play order, each with the address of its file. */
    readonly clips: ReadonlyArray<{ readonly fileUrl: string }>
    /** The address of the voice-over file; none when the video has no voice. */
    readonly voiceUrl?: string | null | undefined
    /** The shots the clips were made from. */
    readonly shots: ReadonlyArray<Shot>
    /** The scenes of the script, used for captions. */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** The shape of the finished video. */
    readonly aspect: VideoAspect
    /** The resolution of the finished video; the default one when absent. */
    readonly resolution?: (typeof COMPOSE_RESOLUTION_NAMES)[number] | undefined
}

/** The render the compose service started, or the refusal of its words. */
export interface VideoComposeOutput {
    /** True when the connected compose service refused the render; nothing was started. */
    readonly refused: boolean
    /** The service's id of the render, or null when refused. */
    readonly renderId: string | null
    /** The provider key that took the render, or null when refused. */
    readonly provider: string | null
    /** Why it was refused, in the service's words when it gave any; null otherwise. */
    readonly why: string | null
    /** True when a person declined the render or the record's update on its card: nothing more was done. */
    readonly declined: boolean
}

const input: NodeSchema<VideoComposeInput, VideoComposeGiven> = z.object({
    renderId: z.string().min(1).max(MAX_ID),
    clips: z.array(z.object({ fileUrl: z.string().min(1).max(MAX_LINE * 8) })).min(1).max(SCENES_MAX),
    voiceUrl: z.string().min(1).max(MAX_LINE * 8).nullable().default(null),
    shots: z.array(shotSchema).min(1).max(SCENES_MAX),
    scenes: z.array(sceneSchema).min(1).max(SCENES_MAX),
    aspect: aspectSchema,
    resolution: z.enum(COMPOSE_RESOLUTION_NAMES).default("hd"),
})

const output: NodeSchema<VideoComposeOutput> = z.object({
    refused: z.boolean().describe("True when the compose service refused the render and nothing was started."),
    renderId: z.string().min(1).max(MAX_ID).nullable().describe("The compose service's id of the render."),
    provider: z.string().min(1).max(PROVIDER_MAX).nullable().describe("The provider that took the render."),
    why: z.string().max(MAX_LINE).nullable(),
    declined: z.boolean().describe("True when a person declined the render (or keeping its id on the render record) on its card: the video is not made."),
})

/** The words a refusal came with: the service's own `detail` when it gave one, else the refusal code. */
const whyOf = (code: string, facts: JsonObject): string => (textOrNull(memberOf(facts, "detail")) ?? code).slice(0, MAX_LINE)

/**
 * `video.compose` (Dung video hoan chinh): joins the stored clips into ONE video at the connected compose service (Shotstack,
 * Creatomate or JSON2Video, in the order the node lists them): NIVO's neutral spec (the clips in scene order, the narration, a caption
 * for each scene heading timed by the clips' lengths, the workspace logo when it has one, the project's frame and the graph's
 * resolution) goes to `nivo.tool.video.compose`, which answers the service's render id at once. The render id and provider are kept on
 * the render record, now `composing`. NIVO joins nothing itself. A service that refuses the render is said in the output (the graph
 * routes it); a person declining the render, or the update of the record, is `declined: true` (the graph ends the run `declined`); a spec the tool finds unsound stops the run.
 */
export const videoComposeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.compose",
    title: videoTitle("nodeVideoComposeTitle"),
    description: { vi: "Gh\u00e9p c\u00e1c \u0111o\u1ea1n phim th\u00e0nh m\u1ed9t video ho\u00e0n ch\u1ec9nh c\u00f9ng l\u1eddi \u0111\u1ecdc, ph\u1ee5 \u0111\u1ec1 v\u00e0 logo t\u1ea1i d\u1ecbch v\u1ee5 d\u1ef1ng video \u0111\u00e3 k\u1ebft n\u1ed1i.", en: "Joins the clips into one finished video with the narration, captions and logo at the connected video service." },
    tools: [TOOL.videoCompose],
    mode: "auto",
    accounts: [PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video],
    input,
    output,
    run: async (given, context) => {
        const made = composeSpecOf({
            clipUrls: given.clips.map((clip) => clip.fileUrl),
            clipSeconds: given.shots.map((shot) => shot.seconds),
            captions: given.scenes.map((scene) => scene.caption),
            voiceUrl: given.voiceUrl,
            logoUrl: context.workspace.logo ?? null,
            aspect: given.aspect,
            resolution: given.resolution,
        })
        if ("problem" in made) return context.fail({ kind: "cannot", why: made.problem })
        const started = await context.tools.call(TOOL.videoCompose, { spec: made.spec })
        if (!started.ok) {
            if (started.declined === true) return { refused: false, renderId: null, provider: null, why: null, declined: true }
            if (started.refusal === "provider_refused")
                return { refused: true, renderId: null, provider: null, why: whyOf(started.refusal, started.facts), declined: false }
            return context.fail({ kind: "cannot", why: `${TOOL.videoCompose} refused: ${started.refusal}` }, started.facts)
        }
        const renderId = memberOf(started.value, "renderId")
        const provider = memberOf(started.value, "provider")
        if (typeof renderId !== "string" || renderId === "" || typeof provider !== "string" || provider === "")
            return context.fail({ kind: "cannot", why: `${TOOL.videoCompose} answered no render id` })
        const kept = await context.tools.call(TOOL.recordUpdate, {
            type: "blocks-core.video.render",
            id: given.renderId,
            patch: { renderId, provider, state: "composing" },
        })
        if (!kept.ok && kept.declined === true) return { refused: false, renderId: null, provider: null, why: null, declined: true }
        valueOrCannot(context, TOOL.recordUpdate, kept)
        return { refused: false, renderId, provider, why: null, declined: false }
    },
    examples: [
        {
            name: "two clips, a narration and headings go to the compose service as one spec; the render id is kept on the record",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }, { fileUrl: "https://files.example/c2.mp4" }],
                voiceUrl: "https://files.example/v.mp3",
                shots: [
                    { key: "1", prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", seconds: 4, aspect: "9:16" },
                    { key: "2", prompt: "\u0110i\u1ec7n tho\u1ea1i nh\u1eafn tin", seconds: 6, aspect: "9:16" },
                ],
                scenes: [
                    { role: "hook", caption: "Hoa h\u1ed3ng gi\u1ea3m 20%", voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m gi\u00e1.", visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf" },
                    { role: "cta", caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho ti\u1ec7m.", visual: "\u0110i\u1ec7n tho\u1ea1i nh\u1eafn tin" },
                ],
                aspect: "9:16",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }, { fileUrl: "https://files.example/c2.mp4" }],
                            audio: [{ fileUrl: "https://files.example/v.mp3", role: "voice", volume: 1 }],
                            captions: [
                                { text: "Hoa h\u1ed3ng gi\u1ea3m 20%", fromMs: 0, toMs: 4000 },
                                { text: "Nh\u1eafn tin \u0111\u1eb7t ngay", fromMs: 4000, toMs: 10_000 },
                            ],
                            aspect: "9:16",
                            resolution: "hd",
                        },
                    },
                    answer: answered({ renderId: "rnd-1", provider: "shotstack" }, viaAccount(PROVIDER.shotstack)),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { renderId: "rnd-1", provider: "shotstack", state: "composing" } },
                    answer: answered({ record: { id: "r1", version: "3", values: {} } }),
                },
            ],
            output: { refused: false, renderId: "rnd-1", provider: "shotstack", why: null, declined: false },
        },
        {
            name: "the workspace logo rides in the top-right corner, a silent video has no audio track",
            params: {},
            workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Ti\u1ec7m Hoa Mai", logo: "https://cdn.example/logo.png" },
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 8, aspect: "16:9" }],
                scenes: [{ role: "hook", caption: "", voiceover: "", visual: "B\u00f3 hoa" }],
                aspect: "16:9",
                resolution: "1080",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                            logo: { fileUrl: "https://cdn.example/logo.png", corner: "top-right" },
                            aspect: "16:9",
                            resolution: "1080",
                        },
                    },
                    answer: answered({ renderId: "cr-9", provider: "creatomate" }, viaAccount(PROVIDER.creatomate)),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { renderId: "cr-9", provider: "creatomate", state: "composing" } },
                    answer: answered({ record: { id: "r1", version: "3", values: {} } }),
                },
            ],
            output: { refused: false, renderId: "cr-9", provider: "creatomate", why: null, declined: false },
        },
        {
            name: "the service refuses the render: its words go on and no render is kept",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 4, aspect: "9:16" }],
                scenes: [{ role: "hook", caption: "M\u1edf \u0111\u1ea7u", voiceover: "Xin ch\u00e0o.", visual: "B\u00f3 hoa" }],
                aspect: "9:16",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                            captions: [{ text: "M\u1edf \u0111\u1ea7u", fromMs: 0, toMs: 4000 }],
                            aspect: "9:16",
                            resolution: "hd",
                        },
                    },
                    answer: refused("provider_refused", { detail: "the plan allows 720p only" }),
                },
            ],
            output: { refused: true, renderId: null, provider: null, why: "the plan allows 720p only", declined: false },
        },
        {
            name: "a person declines the render on its card: nothing is started and the node says declined",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 4, aspect: "9:16" }],
                scenes: [{ role: "hook", caption: "M\u1edf \u0111\u1ea7u", voiceover: "Xin ch\u00e0o.", visual: "B\u00f3 hoa" }],
                aspect: "9:16",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                            captions: [{ text: "M\u1edf \u0111\u1ea7u", fromMs: 0, toMs: 4000 }],
                            aspect: "9:16",
                            resolution: "hd",
                        },
                    },
                    answer: refused("declined"),
                },
            ],
            output: { refused: false, renderId: null, provider: null, why: null, declined: true },
        },
        {
            name: "a person declines keeping the render id on the render record: the node says declined",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 4, aspect: "9:16" }],
                scenes: [{ role: "hook", caption: "M\u1edf \u0111\u1ea7u", voiceover: "Xin ch\u00e0o.", visual: "B\u00f3 hoa" }],
                aspect: "9:16",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                            captions: [{ text: "M\u1edf \u0111\u1ea7u", fromMs: 0, toMs: 4000 }],
                            aspect: "9:16",
                            resolution: "hd",
                        },
                    },
                    answer: answered({ renderId: "rnd-2", provider: "shotstack" }, viaAccount(PROVIDER.shotstack)),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { renderId: "rnd-2", provider: "shotstack", state: "composing" } },
                    answer: refused("declined"),
                },
            ],
            output: { refused: false, renderId: null, provider: null, why: null, declined: true },
        },
        {
            name: "a spec the tool finds unsound stops the run",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 4, aspect: "9:16" }],
                scenes: [{ role: "hook", caption: "M\u1edf \u0111\u1ea7u", voiceover: "Xin ch\u00e0o.", visual: "B\u00f3 hoa" }],
                aspect: "9:16",
            },
            tools: [
                {
                    id: TOOL.videoCompose,
                    args: {
                        spec: {
                            clips: [{ fileUrl: "https://files.example/c1.mp4" }],
                            captions: [{ text: "M\u1edf \u0111\u1ea7u", fromMs: 0, toMs: 4000 }],
                            aspect: "9:16",
                            resolution: "hd",
                        },
                    },
                    answer: refused("invalid_spec"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.videoCompose} refused: invalid_spec` },
        },
        {
            name: "clips and lengths that do not line up are not sent: the run stops",
            params: {},
            input: {
                renderId: "r1",
                clips: [{ fileUrl: "https://files.example/c1.mp4" }, { fileUrl: "https://files.example/c2.mp4" }],
                shots: [{ key: "1", prompt: "B\u00f3 hoa", seconds: 4, aspect: "9:16" }],
                scenes: [{ role: "hook", caption: "M\u1edf \u0111\u1ea7u", voiceover: "Xin ch\u00e0o.", visual: "B\u00f3 hoa" }],
                aspect: "9:16",
            },
            tools: [],
            failure: { kind: "cannot", why: "the clips, their lengths and the headings of the scenes do not line up" },
        },
    ],
})

import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { ClipSeconds, VideoAspect } from "../../rules/video/spec"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot, viaAccount } from "../tool-answers"
import { videoTitle } from "./video.copy"
import { memberOf, shotSchema } from "./video.shapes"

/** The clip of one scene: what it shows, its length and its frame. */
export interface VideoSceneInput {
    /** What the clip shows, as the video provider is asked for it. */
    readonly prompt: string
    /** How long the clip runs. */
    readonly seconds: ClipSeconds
    /** The shape of the clip. */
    readonly aspect: VideoAspect
}

/** The provider's job that generates the clip. */
export interface VideoSceneOutput {
    /** The provider's job, or null when a person declined the scene. */
    readonly jobId: string | null
    /** True when a person declined starting this scene's clip on its card: the video cannot be made whole. */
    readonly declined: boolean
}

const input: NodeSchema<VideoSceneInput> = shotSchema.omit({ key: true })

const output: NodeSchema<VideoSceneOutput> = z.object({
    jobId: z.string().min(1).max(MAX_ID).nullable().describe("The generation job of the scene's clip, as the provider named it; null when a person declined."),
    declined: z.boolean().describe("True when a person declined starting this scene's clip on its card: the video cannot be made whole, so the graph ends the run declined."),
})

/**
 * `video.scenes` (Tao canh video): starts the generation of ONE scene's clip on the connected video account (the graph runs it once
 * per scene of the script) and hands on the provider's job; the clip itself is read later by `video.result`. A request the provider
 * refuses stops this scene; a person declining it is `declined: true`: the loop gathers it and the graph, after the loop, ends the run `declined` (one declined scene spoils the whole video).
 */
export const videoScenesNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.scenes",
    title: videoTitle("nodeVideoScenesTitle"),
    description: { vi: "B\u1eaft \u0111\u1ea7u t\u1ea1o \u0111o\u1ea1n phim cho m\u1ed9t c\u1ea3nh c\u1ee7a k\u1ecbch b\u1ea3n t\u1ea1i d\u1ecbch v\u1ee5 video \u0111\u00e3 k\u1ebft n\u1ed1i.", en: "Starts making the clip for one scene of the script at the connected video service." },
    tools: [TOOL.videoGenerate],
    mode: "auto",
    accounts: [PROVIDER.veo],
    input,
    output,
    run: async (given, context) => {
        const asked = await context.tools.call(TOOL.videoGenerate, {
            prompt: given.prompt,
            aspectRatio: given.aspect,
            durationSeconds: String(given.seconds),
        })
        if (!asked.ok && asked.declined === true) return { jobId: null, declined: true }
        const started = valueOrCannot(context, TOOL.videoGenerate, asked)
        const jobId = memberOf(started, "jobId")
        return typeof jobId === "string" && jobId !== ""
            ? { jobId, declined: false }
            : context.fail({ kind: "cannot", why: `${TOOL.videoGenerate} answered no job` })
    },
    examples: [
        {
            name: "a vertical scene of four seconds is started: its job goes on",
            params: {},
            input: { prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", seconds: 4, aspect: "9:16" },
            tools: [
                {
                    id: TOOL.videoGenerate,
                    args: { prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", aspectRatio: "9:16", durationSeconds: "4" },
                    answer: answered({ jobId: "models/veo/operations/op-1", modelId: "veo-3" }, viaAccount(PROVIDER.veo)),
                },
            ],
            output: { jobId: "models/veo/operations/op-1", declined: false },
        },
        {
            name: "a person declines starting the scene's clip: the node says declined",
            params: {},
            input: { prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", seconds: 4, aspect: "9:16" },
            tools: [
                {
                    id: TOOL.videoGenerate,
                    args: { prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", aspectRatio: "9:16", durationSeconds: "4" },
                    answer: refused("declined"),
                },
            ],
            output: { jobId: null, declined: true },
        },
        {
            name: "the provider refuses the prompt: the scene stops",
            params: {},
            input: { prompt: "C\u1eeda ti\u1ec7m", seconds: 8, aspect: "16:9" },
            tools: [
                {
                    id: TOOL.videoGenerate,
                    args: { prompt: "C\u1eeda ti\u1ec7m", aspectRatio: "16:9", durationSeconds: "8" },
                    answer: refused("rejected"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.videoGenerate} refused: rejected` },
        },
    ],
})

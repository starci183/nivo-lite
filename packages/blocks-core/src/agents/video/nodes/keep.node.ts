import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"
import { SCENES_MAX, memberOf } from "./video.shapes"

/** The finished clips to keep: the project, the provider jobs they came from and the staged clip of each scene, in scene order. */
export interface VideoKeepInput {
    /** The project the files are kept for. */
    readonly projectId: string
    /** The ids of the provider jobs whose files are kept. */
    readonly jobIds: ReadonlyArray<string>
    /** The addresses of the clip files to keep. */
    readonly clips: ReadonlyArray<string>
}

/** The render record that now holds the clips, and how many it holds. */
export interface VideoKeepOutput {
    /** The render record, or null when a person declined the making of it or the storing of a clip. */
    readonly renderId: string | null
    /** How many clip files were kept. */
    readonly clips: number
    /** True when a person declined opening the render record or storing a clip on its card: the clips are not kept. */
    readonly declined: boolean
}

const input: NodeSchema<VideoKeepInput> = z.object({
    projectId: z.string().min(1).max(MAX_ID),
    jobIds: z.array(z.string().min(1).max(MAX_ID)).max(SCENES_MAX),
    clips: z.array(z.string().min(1).max(MAX_LINE)).min(1).max(SCENES_MAX),
})

const output: NodeSchema<VideoKeepOutput> = z.object({
    renderId: z.string().min(1).max(MAX_ID).nullable().describe("The `blocks-core.video.render` record of this making; null when a person declined."),
    clips: z.number().int().min(0).max(SCENES_MAX).describe("How many clips the record holds; 0 when a person declined."),
    declined: z.boolean().describe("True when a person declined opening the render record or storing a clip on its card: the clips are not kept."),
})

/** The file name one scene's clip is kept under. */
const clipNameOf = (index: number): string => `scene-${String(index + 1)}.mp4`

/**
 * `video.keep` (Luu cac doan phim): opens the `blocks-core.video.render` record of this making (the provider jobs, still `generating`)
 * and stores each scene's clip, as the video provider made it and in scene order, in the record's `clips` list: one `nivo.tool.file.put`
 * per clip with the staged file the provider answered. Nothing is joined or re-encoded. A clip the store refuses (a type, a size or the
 * plan's storage) stops the run; a person declining the record or a clip is `declined: true` (the graph ends the run `declined`).
 */
export const videoKeepNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.keep",
    title: videoTitle("nodeVideoKeepTitle"),
    description: { vi: "L\u01b0u t\u1eebng \u0111o\u1ea1n phim c\u1ee7a c\u00e1c c\u1ea3nh v\u00e0o b\u1ea3n ghi d\u1ef1ng video, \u0111\u00fang th\u1ee9 t\u1ef1 c\u1ea3nh.", en: "Stores each scene's clip on the video record, in scene order." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const opened = await context.tools.call(TOOL.recordCreate, {
            type: "blocks-core.video.render",
            values: { projectId: given.projectId, state: "generating", jobs: { ids: [...given.jobIds] } },
        })
        if (!opened.ok && opened.declined === true) return { renderId: null, clips: 0, declined: true }
        const created = valueOrCannot(context, TOOL.recordCreate, opened)
        const renderId = memberOf(memberOf(created, "record"), "id")
        if (typeof renderId !== "string" || renderId === "")
            return context.fail({ kind: "cannot", why: `${TOOL.recordCreate} answered no render id` })
        for (const [index, staged] of given.clips.entries()) {
            const put = await context.tools.call(TOOL.filePut, {
                type: "blocks-core.video.render",
                id: renderId,
                field: "clips",
                staged,
                name: clipNameOf(index),
            })
            if (!put.ok && put.declined === true) return { renderId: null, clips: 0, declined: true }
            valueOrCannot(context, TOOL.filePut, put)
        }
        return { renderId, clips: given.clips.length, declined: false }
    },
    examples: [
        {
            name: "two finished clips are stored on a new render record, in scene order",
            params: {},
            input: { projectId: "p1", jobIds: ["op-1", "op-2"], clips: ["ws/staged/c1", "ws/staged/c2"] },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: "blocks-core.video.render",
                        values: { projectId: "p1", state: "generating", jobs: { ids: ["op-1", "op-2"] } },
                    },
                    answer: answered({ record: { id: "r1", version: "1", values: {} } }),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", staged: "ws/staged/c1", name: "scene-1.mp4" },
                    answer: answered({
                        file: { key: "ws/blocks-core.video.render/r1/clips/o1", mime: "video/mp4", size: 2048, name: "scene-1.mp4" },
                    }),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", staged: "ws/staged/c2", name: "scene-2.mp4" },
                    answer: answered({
                        file: { key: "ws/blocks-core.video.render/r1/clips/o2", mime: "video/mp4", size: 1024, name: "scene-2.mp4" },
                    }),
                },
            ],
            output: { renderId: "r1", clips: 2, declined: false },
        },
        {
            name: "a person declines opening the render record: nothing is kept and the node says declined",
            params: {},
            input: { projectId: "p1", jobIds: ["op-1"], clips: ["ws/staged/c1"] },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: { type: "blocks-core.video.render", values: { projectId: "p1", state: "generating", jobs: { ids: ["op-1"] } } },
                    answer: refused("declined"),
                },
            ],
            output: { renderId: null, clips: 0, declined: true },
        },
        {
            name: "a person declines storing a clip: the node says declined",
            params: {},
            input: { projectId: "p1", jobIds: ["op-1"], clips: ["ws/staged/c1"] },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: { type: "blocks-core.video.render", values: { projectId: "p1", state: "generating", jobs: { ids: ["op-1"] } } },
                    answer: answered({ record: { id: "r1", version: "1", values: {} } }),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", staged: "ws/staged/c1", name: "scene-1.mp4" },
                    answer: refused("declined"),
                },
            ],
            output: { renderId: null, clips: 0, declined: true },
        },
        {
            name: "the store refuses a clip: the run stops",
            params: {},
            input: { projectId: "p1", jobIds: ["op-1"], clips: ["ws/staged/c1"] },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: { type: "blocks-core.video.render", values: { projectId: "p1", state: "generating", jobs: { ids: ["op-1"] } } },
                    answer: answered({ record: { id: "r1", version: "1", values: {} } }),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", staged: "ws/staged/c1", name: "scene-1.mp4" },
                    answer: refused("quota_exceeded"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.filePut} refused: quota_exceeded` },
        },
    ],
})

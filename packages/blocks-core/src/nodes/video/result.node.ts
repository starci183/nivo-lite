import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type NodeContext, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"
import { answered, valueOrCannot, viaAccount } from "../tool-answers"
import { videoTitle } from "./video.copy"
import { SCENES_MAX, memberOf, storedOf } from "./video.shapes"

/** One scene's job as the scenes loop gathered it: the scene's key and the job, or null when that scene did not start. */
export type GatheredJob = {
    /** The step key the job came from. */
    readonly key: string
    /** What the step produced (its job id); null when it produced nothing. */
    readonly output: { readonly jobId: string } | null
}

/** The scenes' jobs, in scene order. */
export interface VideoResultInput {
    /** The jobs gathered from the clip steps, in step order. */
    readonly jobs: ReadonlyArray<GatheredJob>
}

/** Where the scenes stand: still being generated, all done, or one failed. */
export type VideoResultState = "pending" | "done" | "failed"

/** Where the scenes stand, their clips once all are done, and the failure once one failed. */
export interface VideoResultOutput {
    /** The state of the whole render: done, failed or still running. */
    readonly state: VideoResultState
    /** The stored clip of each scene, in scene order, once all are done; empty otherwise. */
    readonly clips: ReadonlyArray<string>
    /** The job ids, in scene order. */
    readonly jobIds: ReadonlyArray<string>
    /** Why a scene failed, in the provider's words, or null. */
    readonly error: string | null
}

const input: NodeSchema<VideoResultInput> = z.object({
    jobs: z
        .array(z.object({ key: z.string().min(1).max(MAX_ID), output: z.object({ jobId: z.string().min(1).max(MAX_ID) }).nullable() }))
        .min(1)
        .max(SCENES_MAX),
})

const output: NodeSchema<VideoResultOutput> = z.object({
    state: z.enum(["pending", "done", "failed"]).describe("pending: some clip is still being made; done: every clip is kept; failed: one scene failed."),
    clips: z.array(z.string().min(1).max(MAX_LINE)).max(SCENES_MAX),
    jobIds: z.array(z.string().min(1).max(MAX_ID)).max(SCENES_MAX),
    error: z.string().max(MAX_LINE).nullable(),
})

/** One job as the generation read answered it: its state, its first stored clip, the provider's words on a failure. */
type JobRead = { readonly state: VideoResultState; readonly clip: string | null; readonly error: string | null }

/** The words a failed job came with, cut. */
const errorOf = (job: unknown): string => {
    const message = memberOf(memberOf(job, "error"), "message")
    return typeof message === "string" && message !== "" ? message.slice(0, MAX_LINE) : "the provider gave no reason"
}

/** One job as it stands: a done job with no clip was held back by the provider's filters, which fails the scene. */
const jobOf = async (context: NodeContext, jobId: string): Promise<JobRead> => {
    const read = valueOrCannot(
        context,
        TOOL.videoGenerationGet,
        await context.tools.call(TOOL.videoGenerationGet, { jobId }),
    )
    const state = memberOf(read, "state")
    if (state === "pending") return { state: "pending", clip: null, error: null }
    if (state !== "done") return { state: "failed", clip: null, error: errorOf(read) }
    const files = memberOf(read, "files")
    const clip = Array.isArray(files) ? storedOf(files[0]) : null
    if (Array.isArray(files) && files.length === 0) return { state: "failed", clip: null, error: "the provider held the clip back" }
    return clip === null
        ? context.fail({ kind: "cannot", why: "a finished clip was not kept by the file store" })
        : { state: "done", clip, error: null }
}

/**
 * `video.result` (Cho cac canh video): reads every scene's generation job once (the graph runs it round after round, a few minutes
 * apart, until every clip is made or one failed) and says where they stand: `pending` while one is still being made, `failed` with the
 * provider's words when one failed or a scene never started, `done` with the stored clips in scene order.
 */
export const videoResultNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.result",
    title: videoTitle("nodeVideoResultTitle"),
    description: { vi: "Xem c\u00e1c c\u1ea3nh phim \u0111\u00e3 t\u1ea1o xong ch\u01b0a: c\u00f2n ch\u1edd, c\u00f3 c\u1ea3nh l\u1ed7i, hay \u0111\u00e3 xong k\u00e8m c\u00e1c \u0111o\u1ea1n phim theo th\u1ee9 t\u1ef1.", en: "Checks whether the scene clips are made: still waiting, one failed, or all done with the clips in order." },
    tools: [TOOL.videoGenerationGet],
    mode: "auto",
    accounts: [PROVIDER.veo],
    input,
    output,
    run: async (given, context) => {
        const jobIds = given.jobs.flatMap((job) => (job.output === null ? [] : [job.output.jobId]))
        if (jobIds.length < given.jobs.length) return { state: "failed", clips: [], jobIds, error: "a scene did not start" }
        const reads: Array<JobRead> = []
        for (const jobId of jobIds) reads.push(await jobOf(context, jobId))
        const failed = reads.find((read) => read.state === "failed")
        if (failed !== undefined) return { state: "failed", clips: [], jobIds, error: failed.error }
        if (reads.some((read) => read.state === "pending")) return { state: "pending", clips: [], jobIds, error: null }
        return { state: "done", clips: reads.flatMap((read) => (read.clip === null ? [] : [read.clip])), jobIds, error: null }
    },
    examples: [
        {
            name: "both scenes are made: their stored clips go on in scene order",
            params: {},
            input: { jobs: [{ key: "1", output: { jobId: "op-1" } }, { key: "2", output: { jobId: "op-2" } }] },
            tools: [
                {
                    id: TOOL.videoGenerationGet,
                    args: { jobId: "op-1" },
                    answer: answered({ jobId: "op-1", state: "done", error: null, files: [{ handle: "f1", stored: "ws/staged/c1" }] }, viaAccount(PROVIDER.veo)),
                },
                {
                    id: TOOL.videoGenerationGet,
                    args: { jobId: "op-2" },
                    answer: answered({ jobId: "op-2", state: "done", error: null, files: [{ handle: "f2", stored: "ws/staged/c2" }] }, viaAccount(PROVIDER.veo)),
                },
            ],
            output: { state: "done", clips: ["ws/staged/c1", "ws/staged/c2"], jobIds: ["op-1", "op-2"], error: null },
        },
        {
            name: "one scene is still being made: the round says pending",
            params: {},
            input: { jobs: [{ key: "1", output: { jobId: "op-1" } }, { key: "2", output: { jobId: "op-2" } }] },
            tools: [
                {
                    id: TOOL.videoGenerationGet,
                    args: { jobId: "op-1" },
                    answer: answered({ jobId: "op-1", state: "done", error: null, files: [{ handle: "f1", stored: "ws/staged/c1" }] }, viaAccount(PROVIDER.veo)),
                },
                {
                    id: TOOL.videoGenerationGet,
                    args: { jobId: "op-2" },
                    answer: answered({ jobId: "op-2", state: "pending", error: null, files: [] }, viaAccount(PROVIDER.veo)),
                },
            ],
            output: { state: "pending", clips: [], jobIds: ["op-1", "op-2"], error: null },
        },
        {
            name: "the provider failed one scene: its words go on",
            params: {},
            input: { jobs: [{ key: "1", output: { jobId: "op-1" } }] },
            tools: [
                {
                    id: TOOL.videoGenerationGet,
                    args: { jobId: "op-1" },
                    answer: answered({ jobId: "op-1", state: "failed", error: { code: 3, message: "prompt blocked" }, files: [] }, viaAccount(PROVIDER.veo)),
                },
            ],
            output: { state: "failed", clips: [], jobIds: ["op-1"], error: "prompt blocked" },
        },
        {
            name: "a scene that never started fails the video before any read",
            params: {},
            input: { jobs: [{ key: "1", output: { jobId: "op-1" } }, { key: "2", output: null }] },
            tools: [],
            output: { state: "failed", clips: [], jobIds: ["op-1"], error: "a scene did not start" },
        },
    ],
})

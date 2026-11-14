import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type NodeContext, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { VIDEO_BRIEF_MAX } from "../../entities/video/project.entity"
import { type ScriptScene, clipPlanOf, scenePromptOf, voiceTextOf } from "../../rules/video/script"
import { SCRIPT_TITLE_MAX, parsedScriptOf } from "../../rules/video/scripting"
import { VIDEO_SCRIPT_RULES } from "../../rules/video/scripting-outlines"
import { SCRIPT_SCENES_ASKED_MAX, scriptAskText } from "../../rules/video/scripting-prompt"
import { type VideoAspect, aspectOf, goalOf, targetSecondsOf } from "../../rules/video/spec"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { videoTitle } from "./video.copy"
import { type Shot, VOICE_TEXT_MAX, aspectSchema, memberOf, sceneSchema, shotSchema } from "./video.shapes"

/** What the script is written from: the words that asked for the video, the project when one exists, the language. */
export interface VideoScriptInput {
    /** What was asked: a team member's line in /chat, or the brief another workflow handed on. */
    readonly text: string
    /** The project to script, or null to open a new one. */
    readonly projectId: string | null
    /** The language of the run. */
    readonly locale: NodeLocale
}

/** The input as a graph binds it: the project and the language may be absent. */
export interface VideoScriptGiven {
    /** The brief the script is written from. */
    readonly text: string
    /** The project to write the script into; a new one is opened when absent. */
    readonly projectId?: string | null | undefined
    /** The language the script is written in; the workspace default when absent. */
    readonly locale?: NodeLocale | undefined
}

/** The written script and everything the next steps make the video from. */
export type VideoScriptOutput = {
    /** The project the script was written to, or null when a person declined writing it. */
    readonly projectId: string | null
    /** The title of the video. */
    readonly title: string
    /** The shape of the video. */
    readonly aspect: VideoAspect
    /** The scenes of the script, in play order. */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** The shots to render, one per scene. */
    readonly shots: ReadonlyArray<Shot>
    /** The text read aloud as the voice-over. */
    readonly voiceText: string
    /** The voice that reads it; null when the video has no voice. */
    readonly voiceId: string | null
    /** True when a person declined writing the script to the project on its card: no script was kept. */
    readonly declined: boolean
}

/** The longest words that ask for a video. */
const ASK_MAX = 4_000

/** The model turns the writer may take: a few brain reads, then the script. */
const MAX_TURNS = 4

const input: NodeSchema<VideoScriptInput, VideoScriptGiven> = z.object({
    text: z.string().min(1).max(ASK_MAX),
    projectId: z.string().min(1).max(MAX_ID).nullable().default(null),
    locale: z.enum(["vi", "en"]).default("vi"),
})

const output: NodeSchema<VideoScriptOutput> = z.object({
    projectId: z.string().min(1).max(MAX_ID).nullable().describe("The project the script was written to; null when a person declined."),
    title: z.string().max(MAX_LINE),
    aspect: aspectSchema,
    scenes: z.array(sceneSchema).max(SCRIPT_SCENES_ASKED_MAX),
    shots: z.array(shotSchema).max(SCRIPT_SCENES_ASKED_MAX).describe("One clip to generate per scene, in order."),
    voiceText: z.string().max(VOICE_TEXT_MAX).describe("What the one voice track says; empty for a silent video."),
    voiceId: z
        .string()
        .min(1)
        .max(MAX_ID)
        .nullable()
        .describe("The brand kit's voice, or null to take the account's first."),
    declined: z.boolean().describe("True when a person declined writing the script to the project on its card: no script was kept, the scenes and shots are empty."),
})

/** What the writer answers: a working title and the scenes. */
const answerSchema = z.object({
    title: z.string().max(SCRIPT_TITLE_MAX),
    scenes: z
        .array(
            z.object({
                caption: z.string().max(200),
                voiceover: z.string().max(600),
                visual: z.string().max(300),
            }),
        )
        .min(2)
        .max(SCRIPT_SCENES_ASKED_MAX),
})

/** The fields of a stored project the script reads. */
const projectValues = z.object({
    title: z.string().max(MAX_LINE),
    goal: z.string().max(MAX_LINE),
    aspect: z.string().max(MAX_LINE),
    targetSeconds: z.number(),
    brief: z.string().max(VIDEO_BRIEF_MAX),
})

/** The fields of the stored brand kit the script reads. */
const brandValues = z.object({
    shopName: z.string().max(MAX_LINE).catch(""),
    voiceId: z.string().max(MAX_ID).nullable().catch(null),
})

type StoredProject = z.infer<typeof projectValues> & { readonly id: string }
type StoredBrand = z.infer<typeof brandValues>

/** The text itself, or none when it is absent or empty (an empty title is no title). */
const nonEmpty = (text: string | undefined): string | undefined => (text === undefined || text === "" ? undefined : text)

/** The values of the record a record tool answered. */
const valuesOf = (answer: JsonObject): unknown => memberOf(memberOf(answer, "record"), "values")

/** The project the run names; the run stops when the record tool refuses it or it is no project. */
const projectOf = async (context: NodeContext, id: string): Promise<StoredProject> => {
    const read = valueOrCannot(
        context,
        TOOL.recordGet,
        await context.tools.call(TOOL.recordGet, { type: "blocks-core.video.project", id }),
    )
    const parsed = projectValues.safeParse(valuesOf(read))
    if (!parsed.success)
        return context.fail({ kind: "cannot", why: `blocks-core.video.project ${id} holds no project` })
    return { id, ...parsed.data }
}

/** The workspace's brand kit, or an empty one when it saved none. */
const brandOf = async (context: NodeContext): Promise<StoredBrand> => {
    const listed = valueOrCannot(
        context,
        TOOL.recordList,
        await context.tools.call(TOOL.recordList, { type: "blocks-core.video.brand-kit", limit: 1 }),
    )
    const records = memberOf(listed, "records")
    const first: unknown = Array.isArray(records) ? records[0] : undefined
    return brandValues.parse(memberOf(first, "values") ?? {})
}

/** The id of the record a create or an update answered. */
const writtenIdOf = (context: NodeContext, written: JsonObject): string => {
    const id = memberOf(memberOf(written, "record"), "id")
    return typeof id === "string" && id !== ""
        ? id
        : context.fail({ kind: "cannot", why: "the record tool answered no id" })
}

/**
 * `video.script` (Viet kich ban video): writes the script of a short shop video. It reads the project the run names (or opens a new
 * one from what was asked) and the workspace's brand kit, asks the writer for a scene-by-scene script on the goal's outline (the writer
 * reads the shop's facts itself through the brain: never an invented price, date or promise), keeps the script on the project, and
 * hands on the clips to generate (the prompt, length and frame of each), the voice text and the brand's voice. A script of fewer than two
 * scenes stops the run; a person declining the write to the project is `declined: true` (the graph ends the run `declined`).
 */
export const videoScriptNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.script",
    title: videoTitle("nodeVideoScriptTitle"),
    description: { vi: "Vi\u1ebft k\u1ecbch b\u1ea3n video ng\u1eafn cho c\u1eeda h\u00e0ng theo t\u1eebng c\u1ea3nh, d\u1ef1a tr\u00ean th\u00f4ng tin th\u1eadt c\u1ee7a c\u1eeda h\u00e0ng v\u00e0 b\u1ed9 nh\u1eadn di\u1ec7n th\u01b0\u01a1ng hi\u1ec7u, kh\u00f4ng b\u1ecba gi\u00e1 hay \u01b0u \u0111\u00e3i.", en: "Writes a short shop video script scene by scene from the shop's real facts and brand kit, never inventing a price or offer." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const project = given.projectId === null ? null : await projectOf(context, given.projectId)
        const brand = await brandOf(context)
        const goal = goalOf(project?.goal)
        const aspect = aspectOf(project?.aspect)
        const targetSeconds = targetSecondsOf(project?.targetSeconds)
        const brief = [project?.brief ?? "", given.text]
            .filter((part) => part.trim() !== "")
            .join("\n")
            .slice(0, VIDEO_BRIEF_MAX)
        const answer = await context.agent.run({
            goal: VIDEO_SCRIPT_RULES,
            input: { ask: scriptAskText({ shop: brand.shopName, goal, aspect, targetSeconds, brief }) },
            output: answerSchema,
            maxTurns: MAX_TURNS,
        })
        const parsed = parsedScriptOf(answer)
        if (parsed === null) return context.fail({ kind: "cannot", why: "the script holds fewer than two scenes" })
        const title = nonEmpty(parsed.title) ?? nonEmpty(project?.title) ?? given.text.slice(0, SCRIPT_TITLE_MAX)
        const script = { scenes: parsed.scenes }
        const written =
            project === null
                ? await context.tools.call(TOOL.recordCreate, {
                      type: "blocks-core.video.project",
                      values: { title, goal, aspect, targetSeconds, brief, status: "scripted", script },
                  })
                : await context.tools.call(TOOL.recordUpdate, {
                      type: "blocks-core.video.project",
                      id: project.id,
                      patch: { title, script, status: "scripted", lastError: null },
                  })
        if (!written.ok && written.declined === true)
            return { projectId: null, title: "", aspect, scenes: [], shots: [], voiceText: "", voiceId: null, declined: true }
        const projectId = writtenIdOf(context, valueOrCannot(context, TOOL.recordCreate, written))
        const clipSeconds = clipPlanOf(parsed.scenes)
        return {
            projectId,
            title,
            aspect,
            scenes: parsed.scenes,
            shots: parsed.scenes.map((scene, index) => ({
                key: String(index + 1),
                prompt: scenePromptOf(scene),
                seconds: clipSeconds[index] ?? 8,
                aspect,
            })),
            voiceText: voiceTextOf(parsed.scenes),
            voiceId: brand.voiceId,
            declined: false,
        }
    },
    examples: [
        {
            name: "a team member asks for an offer video: a new project is opened with the two-scene script, the clips and the voice text follow",
            params: {},
            input: { text: "L\u00e0m video \u01b0u \u0111\u00e3i hoa h\u1ed3ng tu\u1ea7n n\u00e0y" },
            tools: [
                {
                    id: TOOL.recordList,
                    args: { type: "blocks-core.video.brand-kit", limit: 1 },
                    answer: answered({ records: [], next: null }),
                },
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: "blocks-core.video.project",
                        values: {
                            title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                            goal: "custom",
                            aspect: "9:16",
                            targetSeconds: 30,
                            brief: "L\u00e0m video \u01b0u \u0111\u00e3i hoa h\u1ed3ng tu\u1ea7n n\u00e0y",
                            status: "scripted",
                            script: {
                                scenes: [
                                    {
                                        role: "hook",
                                        caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                        voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                        visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                                    },
                                    {
                                        role: "cta",
                                        caption: "Nh\u1eafn tin \u0111\u1eb7t ngay",
                                        voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.",
                                        visual: "",
                                    },
                                ],
                            },
                        },
                    },
                    answer: answered({ record: { id: "p1", version: "1", values: {} } }),
                },
            ],
            agent: [
                {
                    answer: {
                        title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                        scenes: [
                            {
                                caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                            },
                            { caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.", visual: "" },
                        ],
                    },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "\u01b0u \u0111\u00e3i hoa h\u1ed3ng" },
                            answer: answered({ facts: [] }),
                        },
                    ],
                },
            ],
            output: {
                projectId: "p1",
                title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                aspect: "9:16",
                scenes: [
                    {
                        role: "hook",
                        caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                        voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                        visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                    },
                    { role: "cta", caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.", visual: "" },
                ],
                shots: [
                    { key: "1", prompt: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf", seconds: 4, aspect: "9:16" },
                    { key: "2", prompt: "Nh\u1eafn tin \u0111\u1eb7t ngay", seconds: 4, aspect: "9:16" },
                ],
                voiceText: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m. Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.",
                voiceId: null,
                declined: false,
            },
        },
        {
            name: "an existing wide project is scripted again with the brand's voice; a one-scene answer would stop the run",
            params: {},
            input: { text: "Nh\u1ea5n m\u1ea1nh giao trong ng\u00e0y", projectId: "p2" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: "blocks-core.video.project", id: "p2" },
                    answer: answered({
                        record: {
                            id: "p2",
                            version: "3",
                            values: {
                                title: "Gi\u1edbi thi\u1ec7u ti\u1ec7m",
                                goal: "service",
                                aspect: "16:9",
                                targetSeconds: 20,
                                brief: "Ti\u1ec7m hoa qu\u1eadn 3",
                            },
                        },
                    }),
                },
                {
                    id: TOOL.recordList,
                    args: { type: "blocks-core.video.brand-kit", limit: 1 },
                    answer: answered({
                        records: [
                            {
                                id: "b1",
                                version: "1",
                                values: {
                                    shopName: "Ti\u1ec7m Hoa Mai",
                                    voiceId: "voice-1",
                                },
                            },
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: {
                        type: "blocks-core.video.project",
                        id: "p2",
                        patch: {
                            title: "Ti\u1ec7m Hoa Mai",
                            script: {
                                scenes: [
                                    {
                                        role: "hook",
                                        caption: "Hoa t\u01b0\u01a1i m\u1ed7i s\u00e1ng",
                                        voiceover: "",
                                        visual: "C\u1eeda ti\u1ec7m bu\u1ed5i s\u00e1ng",
                                    },
                                    {
                                        role: "body",
                                        caption: "",
                                        voiceover: "Giao trong ng\u00e0y kh\u1eafp qu\u1eadn ba.",
                                        visual: "",
                                    },
                                    {
                                        role: "cta",
                                        caption: "G\u1ecdi ngay",
                                        voiceover: "G\u1ecdi ti\u1ec7m \u0111\u1ec3 \u0111\u1eb7t hoa.",
                                        visual: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i",
                                    },
                                ],
                            },
                            status: "scripted",
                            lastError: null,
                        },
                    },
                    answer: answered({ record: { id: "p2", version: "4", values: {} } }),
                },
            ],
            agent: [
                {
                    answer: {
                        title: "Ti\u1ec7m Hoa Mai",
                        scenes: [
                            { caption: "Hoa t\u01b0\u01a1i m\u1ed7i s\u00e1ng", voiceover: "", visual: "C\u1eeda ti\u1ec7m bu\u1ed5i s\u00e1ng" },
                            { caption: "", voiceover: "Giao trong ng\u00e0y kh\u1eafp qu\u1eadn ba.", visual: "" },
                            { caption: "G\u1ecdi ngay", voiceover: "G\u1ecdi ti\u1ec7m \u0111\u1ec3 \u0111\u1eb7t hoa.", visual: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i" },
                        ],
                    },
                },
            ],
            output: {
                projectId: "p2",
                title: "Ti\u1ec7m Hoa Mai",
                aspect: "16:9",
                scenes: [
                    { role: "hook", caption: "Hoa t\u01b0\u01a1i m\u1ed7i s\u00e1ng", voiceover: "", visual: "C\u1eeda ti\u1ec7m bu\u1ed5i s\u00e1ng" },
                    { role: "body", caption: "", voiceover: "Giao trong ng\u00e0y kh\u1eafp qu\u1eadn ba.", visual: "" },
                    { role: "cta", caption: "G\u1ecdi ngay", voiceover: "G\u1ecdi ti\u1ec7m \u0111\u1ec3 \u0111\u1eb7t hoa.", visual: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i" },
                ],
                shots: [
                    { key: "1", prompt: "C\u1eeda ti\u1ec7m bu\u1ed5i s\u00e1ng", seconds: 4, aspect: "16:9" },
                    { key: "2", prompt: "Giao trong ng\u00e0y kh\u1eafp qu\u1eadn ba.", seconds: 4, aspect: "16:9" },
                    { key: "3", prompt: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i", seconds: 4, aspect: "16:9" },
                ],
                voiceText: "Giao trong ng\u00e0y kh\u1eafp qu\u1eadn ba. G\u1ecdi ti\u1ec7m \u0111\u1ec3 \u0111\u1eb7t hoa.",
                voiceId: "voice-1",
                declined: false,
            },
        },
        {
            name: "a person declines writing the new project: nothing is kept and the node says declined",
            params: {},
            input: { text: "L\u00e0m video \u01b0u \u0111\u00e3i hoa h\u1ed3ng tu\u1ea7n n\u00e0y" },
            tools: [
                {
                    id: TOOL.recordList,
                    args: { type: "blocks-core.video.brand-kit", limit: 1 },
                    answer: answered({ records: [], next: null }),
                },
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: "blocks-core.video.project",
                        values: {
                            title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                            goal: "custom",
                            aspect: "9:16",
                            targetSeconds: 30,
                            brief: "L\u00e0m video \u01b0u \u0111\u00e3i hoa h\u1ed3ng tu\u1ea7n n\u00e0y",
                            status: "scripted",
                            script: {
                                scenes: [
                                    {
                                        role: "hook",
                                        caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                        voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                        visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                                    },
                                    {
                                        role: "cta",
                                        caption: "Nh\u1eafn tin \u0111\u1eb7t ngay",
                                        voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.",
                                        visual: "",
                                    },
                                ],
                            },
                        },
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [
                {
                    answer: {
                        title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                        scenes: [
                            {
                                caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                            },
                            { caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.", visual: "" },
                        ],
                    },
                },
            ],
            output: {
                projectId: null,
                title: "",
                aspect: "9:16",
                scenes: [],
                shots: [],
                voiceText: "",
                voiceId: null,
                declined: true,
            },
        },
        {
            name: "a person declines writing the script on an existing project: the node says declined",
            params: {},
            input: { text: "Nh\u1ea5n m\u1ea1nh giao trong ng\u00e0y", projectId: "p3" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: "blocks-core.video.project", id: "p3" },
                    answer: answered({
                        record: {
                            id: "p3",
                            version: "3",
                            values: { title: "Gi\u1edbi thi\u1ec7u ti\u1ec7m", goal: "service", aspect: "16:9", targetSeconds: 20, brief: "Ti\u1ec7m hoa qu\u1eadn 3" },
                        },
                    }),
                },
                {
                    id: TOOL.recordList,
                    args: { type: "blocks-core.video.brand-kit", limit: 1 },
                    answer: answered({ records: [], next: null }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: {
                        type: "blocks-core.video.project",
                        id: "p3",
                        patch: {
                            title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                            script: {
                                scenes: [
                                    {
                                        role: "hook",
                                        caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                        voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                        visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                                    },
                                    {
                                        role: "cta",
                                        caption: "Nh\u1eafn tin \u0111\u1eb7t ngay",
                                        voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.",
                                        visual: "",
                                    },
                                ],
                            },
                            status: "scripted",
                            lastError: null,
                        },
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [
                {
                    answer: {
                        title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng",
                        scenes: [
                            {
                                caption: "Hoa h\u1ed3ng gi\u1ea3m 20%",
                                voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.",
                                visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf",
                            },
                            { caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho shop \u0111\u1ec3 \u0111\u1eb7t.", visual: "" },
                        ],
                    },
                },
            ],
            output: {
                projectId: null,
                title: "",
                aspect: "16:9",
                scenes: [],
                shots: [],
                voiceText: "",
                voiceId: null,
                declined: true,
            },
        },
    ],
})

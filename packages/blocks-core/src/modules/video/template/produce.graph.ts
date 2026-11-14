import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    absent,
    defineTemplateGraph,
    equals,
    ifNode,
    item,
    loop,
    node,
    or,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"
import { videoComposeNode } from "../../../nodes/video/compose.node"
import { videoKeepNode } from "../../../nodes/video/keep.node"
import { videoLinksNode } from "../../../nodes/video/links.node"
import { videoOutputNode } from "../../../nodes/video/output.node"
import { videoPublishNode } from "../../../nodes/video/publish.node"
import { videoRenderCheckNode } from "../../../nodes/video/render-check.node"
import { videoResultNode } from "../../../nodes/video/result.node"
import { videoReviewNode } from "../../../nodes/video/review.node"
import { videoScenesNode } from "../../../nodes/video/scenes.node"
import { videoScriptNode } from "../../../nodes/video/script.node"
import { videoStuckNode } from "../../../nodes/video/stuck.node"
import { videoLine } from "../../../nodes/video/video.copy"
import { videoVoiceNode } from "../../../nodes/video/voice.node"

/** The key of the video workflow. */
export const VIDEO_PRODUCE_KEY = "video.produce"

/** The most scenes one video is made of: the script's most. */
const SCENES_MAX = 8

/** The most waits for the scenes' clips, two minutes apart, before the video is reported as not made. */
const WAITS_MAX = 10

/** The resolution the composed video is asked for. */
const RESOLUTION = "hd"

/** Minutes between two reads of the render at the compose service. */
const RENDER_POLL_MINUTES = 6

/** The most reads of the render, six minutes apart (an hour), before the video is reported as not made. */
const RENDER_POLLS_MAX = 10

/** The language of the graph's steps (the team reads Vietnamese). */
const LOCALE = "vi"

/** The longest words that ask for a video. */
const ASK_MAX = 4_000

/**
 * Whether the scene at `index` was declined by a person: `scenes` gathers each scene's output per item, and an index past the shots
 * of this video holds nothing (the default null never equals true). One scene declined spoils the video, so `scenes-declined` asks all
 * of the script's most (`SCENES_MAX`) places.
 */
const sceneDeclined = (index: number): ReturnType<typeof equals> =>
    equals(ref(`steps.scenes.output.items.${String(index)}.output.declined`, { default: null }), true)

/**
 * The graph's contract: the brief another workflow hands on (the content agent calls this workflow with its post's brief) and, from a
 * caller, the project to make it for. A line in /chat never starts it: the chat trigger supplies only the words and the writer, with no
 * exact field that says the video agent was addressed, and a text match is forbidden.
 */
const produceInput = z.object({
    text: z.string().min(1).max(ASK_MAX),
    projectId: z.string().min(1).max(MAX_ID).nullish(),
})

/** What the template catalogue shows of `video.produce`, version 5. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "D\u1ef1ng video", en: "Make a video" },
    summary: {
        vi: "Vi\u1ebft k\u1ecbch b\u1ea3n, t\u1ea1o m\u1ed9t \u0111o\u1ea1n phim cho m\u1ed7i c\u1ea3nh, \u0111\u1ecdc l\u1eddi, nh\u1edd d\u1ecbch v\u1ee5 d\u1ef1ng \u0111\u00e3 k\u1ebft n\u1ed1i gh\u00e9p th\u00e0nh m\u1ed9t video c\u00f3 ph\u1ee5 \u0111\u1ec1 r\u1ed3i b\u00e1o ch\u1ee7 duy\u1ec7t tr\u01b0\u1edbc khi \u0111\u0103ng",
        en: "Writes the script, generates a video clip for each scene, records the narration, has the connected compose service join them into one captioned video and tells the founder before anything is published",
    },
    version: 6,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}

/**
 * Change from version 4: `script`, `scenes`, `keep`, `voice`, `compose`, `output` and `review` declined (a person declined one of their writes on its
 * card) -> outcome `declined` (each step's `<step>-declined` tells the team through `<step>-declined-notice`; `scenes` runs in a loop over the
 * shots, so one declined scene is carried out of the loop in its gathered items and `scenes-declined`, after the loop, ends the run, with a
 * notice, before any clip is waited for). Not a failure: no `stuck` step runs. `script-declined` and `keep-declined` also test that the
 * member later steps read (`projectId`, `renderId`) is present, which is what lets the save check prove it non-null on the road on.
 *
 * `video.produce` version 5 (started by a workflow call alone): `script` writes the scene-by-scene script on the project (a new one when
 * the call names none), `scenes` starts one Veo clip per scene (`loop over` the shots), `clips-wait` reads the clips round after round
 * two minutes apart (`loop until` every clip is made or one failed); `made` routes a failed scene, like a wait that ran out
 * (`exhausted`), to `stuck` (the project fails, the founder is told) and the outcome `failed`. Made clips are stored as they are on a
 * render record (`keep`), the script's words are read aloud as a separate narration file on the same record (`voice`); `links` signs a
 * seven-day address for each stored file and `compose` hands them, with the captions and the workspace logo, to the connected compose
 * service as ONE neutral spec (Shotstack, Creatomate or JSON2Video; with none connected the graph is hidden). `composed` routes a
 * refused render to `compose-stuck`. `render-poll` reads the render every six minutes (`loop until` done or failed, at most an hour,
 * then `render-stuck`); `checked` routes a failed render to `render-stuck`; `output` copies the finished video into the render record
 * (the service keeps its address a limited time) and marks it done; `review` tells the founder; a person then approves the publish
 * (`publish`, mode `ask`); a declined publish is told to the team (`declined-notice`) and ends `declined`. NIVO joins, mixes and
 * captions nothing itself. The render's completion event is not waited on yet: its trigger constant does not exist, so the graph reads
 * the render by polling only.
 */
export const videoProduceGraph: TemplateGraph = defineTemplateGraph({
    key: VIDEO_PRODUCE_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: produceInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "script",
    nodes: {
        script: node(videoScriptNode, {
            input: { text: ref("trigger.data.text"), projectId: ref("trigger.data.projectId", { default: null }), locale: LOCALE },
            next: "script-declined",
        }),
        "script-declined": ifNode({
            when: or(equals(ref("steps.script.output.declined"), true), absent(ref("steps.script.output.projectId"))),
            yes: "script-declined-notice",
            no: "scenes",
        }),
        "script-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoScriptTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        scenes: loop({
            over: ref("steps.script.output.shots"),
            key: "key",
            max: SCENES_MAX,
            concurrency: 2,
            body: {
                start: "start",
                collect: "start",
                nodes: {
                    start: node(videoScenesNode, {
                        input: { prompt: item("prompt"), seconds: item("seconds"), aspect: item("aspect") },
                    }),
                },
            },
            next: "scenes-declined",
        }),
        "scenes-declined": ifNode({
            when: or(
                sceneDeclined(0),
                sceneDeclined(1),
                sceneDeclined(2),
                sceneDeclined(3),
                sceneDeclined(4),
                sceneDeclined(5),
                sceneDeclined(6),
                sceneDeclined(7),
            ),
            yes: "scenes-declined-notice",
            no: "clips-wait",
        }),
        "scenes-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoScenesTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        "clips-wait": loop({
            until: or(
                equals(ref("steps.result.output.state"), "done"),
                equals(ref("steps.result.output.state"), "failed"),
            ),
            max: WAITS_MAX,
            every: { minutes: 2 },
            body: {
                start: "result",
                nodes: { result: node(videoResultNode, { input: { jobs: ref("steps.scenes.output.items") } }) },
            },
            next: "made",
            exhausted: "stuck",
        }),
        made: ifNode({ when: equals(ref("steps.clips-wait.output.last.state"), "done"), yes: "keep", no: "stuck" }),
        keep: node(videoKeepNode, {
            input: {
                projectId: ref("steps.script.output.projectId"),
                jobIds: ref("steps.clips-wait.output.last.jobIds", { default: [] }),
                clips: ref("steps.clips-wait.output.last.clips", { default: [] }),
            },
            next: "keep-declined",
        }),
        "keep-declined": ifNode({
            when: or(equals(ref("steps.keep.output.declined"), true), absent(ref("steps.keep.output.renderId"))),
            yes: "keep-declined-notice",
            no: "voice",
        }),
        "keep-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoKeepTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        voice: node(videoVoiceNode, {
            input: {
                text: ref("steps.script.output.voiceText"),
                voiceId: ref("steps.script.output.voiceId", { default: null }),
                renderId: ref("steps.keep.output.renderId"),
            },
            next: "voice-declined",
        }),
        "voice-declined": ifNode({
            when: equals(ref("steps.voice.output.declined"), true),
            yes: "voice-declined-notice",
            no: "links",
        }),
        "voice-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoVoiceTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        links: node(videoLinksNode, { input: { renderId: ref("steps.keep.output.renderId") }, next: "compose" }),
        compose: node(videoComposeNode, {
            input: {
                renderId: ref("steps.keep.output.renderId"),
                clips: ref("steps.links.output.clips"),
                voiceUrl: ref("steps.links.output.voiceUrl"),
                shots: ref("steps.script.output.shots"),
                scenes: ref("steps.script.output.scenes"),
                aspect: ref("steps.script.output.aspect"),
                resolution: RESOLUTION,
            },
            next: "compose-declined",
        }),
        "compose-declined": ifNode({
            when: equals(ref("steps.compose.output.declined"), true),
            yes: "compose-declined-notice",
            no: "composed",
        }),
        "compose-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoComposeTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        composed: ifNode({
            when: equals(ref("steps.compose.output.refused"), true),
            yes: "compose-stuck",
            no: "render-poll",
        }),
        "render-poll": loop({
            until: or(
                equals(ref("steps.render-check.output.status"), "done"),
                equals(ref("steps.render-check.output.status"), "failed"),
            ),
            max: RENDER_POLLS_MAX,
            every: { minutes: RENDER_POLL_MINUTES },
            body: {
                start: "render-check",
                nodes: {
                    "render-check": node(videoRenderCheckNode, { input: { renderId: ref("steps.compose.output.renderId", { default: null }) } }),
                },
            },
            next: "checked",
            exhausted: "render-stuck",
        }),
        checked: ifNode({
            when: equals(ref("steps.render-poll.output.last.status"), "done"),
            yes: "output",
            no: "render-stuck",
        }),
        output: node(videoOutputNode, {
            input: {
                renderId: ref("steps.keep.output.renderId"),
                outputUrl: ref("steps.render-poll.output.last.outputUrl", { default: null }),
            },
            next: "output-declined",
        }),
        "output-declined": ifNode({
            when: equals(ref("steps.output.output.declined"), true),
            yes: "output-declined-notice",
            no: "review",
        }),
        "output-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoOutputTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        review: node(videoReviewNode, {
            input: {
                projectId: ref("steps.script.output.projectId"),
                title: ref("steps.script.output.title"),
                clips: ref("steps.keep.output.clips"),
                voiceKept: ref("steps.voice.output.kept"),
                locale: LOCALE,
            },
            next: "review-declined",
        }),
        "review-declined": ifNode({
            when: equals(ref("steps.review.output.declined"), true),
            yes: "review-declined-notice",
            no: "publish",
        }),
        "review-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoReviewTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        publish: node(videoPublishNode, {
            input: { projectId: ref("steps.script.output.projectId") },
            next: "publish-declined",
        }),
        "publish-declined": ifNode({
            when: equals(ref("steps.publish.output.declined"), true),
            yes: "declined-notice",
            no: "published",
        }),
        "declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: videoLine(LOCALE, "nodeVideoPublishTitle"), ref: ref("steps.script.output.projectId"), locale: LOCALE },
            next: "declined",
        }),
        stuck: node(videoStuckNode, {
            input: {
                projectId: ref("steps.script.output.projectId"),
                title: ref("steps.script.output.title"),
                error: ref("steps.clips-wait.output.last.error", { default: null }),
                locale: LOCALE,
            },
            next: "failed",
        }),
        "compose-stuck": node(videoStuckNode, {
            input: {
                projectId: ref("steps.script.output.projectId"),
                renderId: ref("steps.keep.output.renderId"),
                title: ref("steps.script.output.title"),
                error: ref("steps.compose.output.why", { default: null }),
                locale: LOCALE,
            },
            next: "failed",
        }),
        "render-stuck": node(videoStuckNode, {
            input: {
                projectId: ref("steps.script.output.projectId"),
                renderId: ref("steps.keep.output.renderId"),
                title: ref("steps.script.output.title"),
                error: ref("steps.render-poll.output.last.error", { default: null }),
                locale: LOCALE,
            },
            next: "failed",
        }),
        published: outcome({ name: "published", output: { projectId: ref("steps.script.output.projectId") } }),
        declined: outcome({ name: "declined", output: { projectId: ref("steps.script.output.projectId") } }),
        failed: outcome({ name: "failed", output: { projectId: ref("steps.script.output.projectId") } }),
    },
})

import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type GraphStep,
    type TemplateCatalogue,
    type TemplateGraph,
    type Bound,
    callWorkflow,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { bilingualOf, messageOf } from "../../../messages/catalog"
import { contentApprovedNoticeNode } from "../../../nodes/content/approved-notice.node"
import { contentDraftNode } from "../../../nodes/content/draft.node"
import { contentReviewNode } from "../../../nodes/content/review.node"
import { type DeclinedNoticeScope, teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"

/** The key of the drafting workflow. */
export const CONTENT_DRAFT_GRAPH_KEY = "content.draft"

/** The channel whose approved post the video agent turns into a video. */
const VIDEO_CHANNEL = "tiktok"

/** What the template catalogue shows of `content.draft`. */
const CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("contentDraftTemplateName"),
    summary: bilingualOf("contentDraftTemplateSummary"),
    version: 3,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nh\u1eadn tham s\u1ed1 c\u1ee7a b\u01b0\u1edbc g\u1ecdi trong d\u1eef li\u1ec7u c\u1ee7a s\u1ef1 ki\u1ec7n (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
    seedActive: true,
}

/**
 * The steps that write one post, have a person approve it and tell the team, keyed `draft`, `draft-declined`, `draft-declined-notice`,
 * `review`, `approved`, `notice`; `postId` is the post, `afterNotice` the step after the notice and `declined` the step of a declined
 * post (also the step after the team notice of a declined draft write); `scope` says what that decline stops: the run (the one-post
 * workflow) or one item (the plan's loop). The plan's loop and the one-post workflow place the same steps.
 */
export const draftStepsOf = (
    postId: Bound<string>,
    afterNotice: string | undefined,
    declined: string,
    scope: DeclinedNoticeScope,
): Readonly<Record<string, GraphStep>> => ({
    draft: node(contentDraftNode, { input: { postId }, next: "draft-declined" }),
    // A person declined saving the words: the post keeps none; the team is told, then the run (or the item) ends.
    "draft-declined": ifNode({
        when: equals(ref("steps.draft.output.declined"), true),
        yes: "draft-declined-notice",
        no: "review",
    }),
    "draft-declined-notice": node(teamDeclinedNoticeNode, {
        input: { step: messageOf("vi", "nodeContentDraftTitle"), ref: null, scope },
        next: declined,
    }),
    review: node(contentReviewNode, { input: { postId }, next: "approved" }),
    approved: ifNode({ when: equals(ref("steps.review.output.approved"), true), yes: "notice", no: declined }),
    notice: node(contentApprovedNoticeNode, {
        input: { postId, channel: ref("steps.draft.output.channel"), title: ref("steps.draft.output.title") },
        ...(afterNotice === undefined ? {} : { next: afterNotice }),
    }),
})

/**
 * `content.draft` version 2: called with one post (from a person's ask through another workflow, or any workflow).
 * The post is written (`draft`), a person approves it on a card in /chat (`review`, mode ask) and an approved post is told to the team
 * as waiting to be published by hand (`notice`); no tool publishes to Meta or Zalo OA yet (SHAPE-NOTES `3-A-content`). An approved
 * TikTok post is handed to the video agent (`video.produce`) with its words as the brief. A declined post stays a draft.
 * Change from version 1: `draft` declined -> outcome `declined` (a person declined saving the words: the team is told, the run ends `declined`).
 */
export const contentDraftGraph: TemplateGraph = defineTemplateGraph({
    key: CONTENT_DRAFT_GRAPH_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: z.object({ postId: z.string().min(1).max(MAX_ID) }) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "draft",
    nodes: {
        ...draftStepsOf(ref("trigger.data.postId"), "is-video", "declined", "run"),
        "is-video": ifNode({
            when: equals(ref("steps.draft.output.channel"), VIDEO_CHANNEL),
            yes: "to-video",
            no: "approved-post",
        }),
        "to-video": callWorkflow({
            agent: "video",
            workflow: "produce",
            input: { text: ref("steps.draft.output.text") },
            next: "approved-post",
        }),
        "approved-post": outcome({ name: "approved", output: { postId: ref("trigger.data.postId") } }),
        declined: outcome({ name: "declined", output: { postId: ref("trigger.data.postId") } }),
    },
})

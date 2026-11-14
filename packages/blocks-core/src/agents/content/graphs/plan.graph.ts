import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    equals,
    endItem,
    ifNode,
    item,
    loop,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY } from "../../../shared/bounds"
import { bilingualOf, messageOf } from "../../../shared/messages/catalog"
import { PLAN_POSTS_MAX, contentPlanNode } from "../nodes/plan.node"
import { teamDeclinedNoticeNode } from "../../../shared/team-chat/team/declined-notice.node"
import { draftStepsOf } from "./draft.graph"

/** The key of the monthly plan. */
export const CONTENT_PLAN_GRAPH_KEY = "content.plan"

/** What the template catalogue shows of `content.plan`: its name, summary and the one current version. */
const CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("contentPlanTemplateName"),
    summary: bilingualOf("contentPlanTemplateSummary"),
    version: 4,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nh\u1eadn tham s\u1ed1 c\u1ee7a b\u01b0\u1edbc g\u1ecdi trong d\u1eef li\u1ec7u c\u1ee7a s\u1ef1 ki\u1ec7n (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
    seedActive: true,
}

/**
 * `content.plan` version 2: every morning (07:00 on the shop's clock; no monthly clock preset exists) and when
 * another workflow calls it (a team chat line is never a trigger here: that verb carries no exact field naming the agent). The morning run first hands the weekly report on (`to-report`: one clock per agent, so the
 * report has no clock of its own; it posts on Mondays only). Then it plans the posts of the rest of the month that are not planned yet
 * (`plan`; a morning with nothing new asks no model). Each new post, two at a time, is then written, approved by a person on a card in /chat and told to the
 * team as waiting to be published (`posts`: the same steps as `content.draft`).
 * Change from version 1: `plan` declined -> outcome `declined` (a person declined a draft post: the posts written before it stay, the team is told, the run ends `declined`); in `posts`, a declined `draft` ends that item only (the posts are independent: a team notice with scope `item`, then `endItem`).
 */
export const contentPlanGraph: TemplateGraph = defineTemplateGraph({
    key: CONTENT_PLAN_GRAPH_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({
        // The event's data (the one pipeline's trigger scope): the clock's slot, or the words of a call (a call carries no slot).
        data: z
            .object({
                slotMs: z.number().int().positive().nullable().optional(),
                text: z.string().max(MAX_BODY).optional(),
            })
            .optional(),
    }),
    triggers: [
        trigger(TRIGGER.clockTick, { args: { preset: "daily_at", at: "07:00" } }),
        trigger(TRIGGER.workflowCalled),
    ],
    openTo: "agent",
    start: "is-clock",
    nodes: {
        "is-clock": ifNode({
            when: present(ref("trigger.data.slotMs", { default: null })),
            yes: "to-report",
            no: "plan",
        }),
        "to-report": callWorkflow({ agent: "content", workflow: "report", input: {}, next: "plan" }),
        plan: node(contentPlanNode, {
            input: { text: ref("trigger.data.text", { default: null }) },
            next: "plan-declined",
        }),
        "plan-declined": ifNode({
            when: equals(ref("steps.plan.output.declined"), true),
            yes: "plan-declined-notice",
            no: "posts",
        }),
        "plan-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeContentPlanTitle"), ref: null },
            next: "declined",
        }),
        posts: loop({
            over: ref("steps.plan.output.postIds"),
            key: ".",
            max: PLAN_POSTS_MAX,
            concurrency: 2,
            body: { start: "draft", nodes: draftStepsOf(item(), undefined, endItem, "item") },
            next: "planned",
        }),
        planned: outcome({ name: "planned", output: { planned: ref("steps.plan.output.planned") } }),
        declined: outcome({ name: "declined", output: { planned: ref("steps.plan.output.planned") } }),
    },
})

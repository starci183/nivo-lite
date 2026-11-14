import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { hiringDigestNode } from "../nodes/digest.node"
import { hiringNotifyNode } from "../nodes/notify.node"

/** The name of the workflow, as the market and the workflow list show it. */
const DIGEST_NAME = { vi: "B\u1ea3n tin tuy\u1ec3n d\u1ee5ng", en: "Hiring digest" }

/**
 * `hiring.digest` version 1 (Ban tin tuyen dung): each weekday morning the open jobs and the candidates still in progress are written
 * up for the team (`digest`); only when something is open (`open`, an exact boolean) the line is posted (`notify`).
 */
export const hiringDigestGraph: TemplateGraph = defineTemplateGraph({
    key: "hiring.digest",
    title: DIGEST_NAME,
    // The clock's slot (epoch milliseconds); optional: a person's "run now" supplies none.
    input: z.object({ data: z.object({ slotMs: z.number().int().positive().nullable().optional() }).optional() }),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "weekdays_at", at: "08:30" } })],
    openTo: "agent",
    start: "digest",
    nodes: {
        digest: node(hiringDigestNode, { input: { slotMs: ref("trigger.data.slotMs") }, next: "has-open" }),
        "has-open": ifNode({
            when: equals(ref("steps.digest.output.open"), true),
            yes: "notify",
            no: "quiet",
        }),
        notify: node(hiringNotifyNode, {
            input: { title: ref("steps.digest.output.title"), text: ref("steps.digest.output.text") },
            next: "posted",
        }),
        posted: outcome({ name: "posted" }),
        quiet: outcome({ name: "quiet" }),
    },
    catalogue: {
        name: DIGEST_NAME,
        summary: {
            vi: "M\u1ed7i s\u00e1ng ng\u00e0y l\u00e0m vi\u1ec7c b\u00e1o \u0111\u1ed9i v\u1ecb tr\u00ed \u0111ang tuy\u1ec3n v\u00e0 \u1ee9ng vi\u00ean \u0111ang ch\u1edd",
            en: "Each weekday morning tells the team the open jobs and the candidates waiting",
        },
        version: 2,
        publishedAt: "2026-11-14T03:00:00.000Z",
        notes: {
            vi: "\u0110\u1ecdc s\u1ef1 ki\u1ec7n theo m\u1ed9t \u0111\u01b0\u1eddng chung: route, li\u00ean h\u1ec7, t\u00e0i kho\u1ea3n v\u00e0 d\u1eef li\u1ec7u c\u1ee7a s\u1ef1 ki\u1ec7n (trigger.data)",
            en: "Reads its event on the one pipeline: the route, the contact, the account and the event's data (trigger.data)",
        },
        seedActive: true,
    },
})

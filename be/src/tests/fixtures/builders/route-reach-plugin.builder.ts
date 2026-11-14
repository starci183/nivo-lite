import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { PROVIDER, TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    callWorkflow,
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    ifNode,
    node,
    outcome,
    present,
    ref,
    toolOk,
    toolRefused,
    trigger,
    type TemplateAgent,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

// THE ROUTE REACH FIXTURE (E-SMALL item 1, R75 second kind): a NOTE workflow, no person, no channel, no model. Its one routing node sorts a
// note into three routes and reports the routes the engine named closed (`ctx.run.unreachable`). `file` hands the note to this agent's
// own `file` workflow (live: registered on `workflow.called`); `post` goes through a data condition to two calls of a module no fixture
// installs (`tledger.post`); `drop` ends the run. The node takes the first route the engine left open, in that order.

/** The template agent's key: the module of its graphs. */
export const ROUTES_AGENT = "troutes"

/** The routing workflow (primary). */
export const ROUTES_SORT = "troutes.sort"

/** The called workflow (seeded active, registered on `workflow.called`). */
export const ROUTES_FILE = "troutes.file"

/** The routes of the sort node, in the order it prefers them. */
const ROUTES = ["file", "post", "drop"] as const

const sortOutput = z.object({ route: z.enum(ROUTES), closed: z.array(z.string().max(40)).max(ROUTES.length) })

/** Sorts a note: the first route the engine did not name closed, and the closed ones as it was handed them. */
export const sortNode = defineTemplateNode({
    id: "troutes.sort",
    title: { vi: "Phân luồng", en: "Sort" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ noteId: z.string().max(500) }),
    output: sortOutput,
    routes: { by: "route", names: ["file", "post", "drop"] },
    run: (_given, ctx) => {
        const closed = [...(ctx.run.unreachable ?? [])]
        const route = ROUTES.find((one) => !closed.includes(one)) ?? "drop"
        return Promise.resolve({ route, closed })
    },
    examples: [
        { name: "every route open", params: {}, input: { noteId: "n-1" }, output: { route: "file", closed: [] } },
        {
            name: "file closed",
            params: {},
            input: { noteId: "n-1" },
            unreachable: ["file"],
            output: { route: "post", closed: ["file"] },
        },
    ],
})

const INPUT = z.object({ noteId: z.string().max(500) })

const CATALOGUE_AT = "2026-11-14T12:00:00.000Z"

/** Sorts the note and follows its route: a call of a live workflow, calls behind a condition of a missing module, or the end. */
export const sortGraph: TemplateGraph = defineTemplateGraph({
    key: ROUTES_SORT,
    title: { vi: ROUTES_SORT, en: ROUTES_SORT },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "sort",
    nodes: {
        sort: node(sortNode, {
            input: { noteId: ref("trigger.noteId") },
            routes: { file: "to-file", post: "post-when", drop: "dropped" },
        }),
        "to-file": callWorkflow({ agent: ROUTES_AGENT, workflow: "file", version: "latest", input: { noteId: ref("trigger.noteId") } }),
        "post-when": ifNode({ when: present(ref("trigger.noteId")), yes: "to-post", no: "to-post-later" }),
        "to-post": callWorkflow({ agent: "tledger", workflow: "post", version: "latest", input: { noteId: ref("trigger.noteId") } }),
        "to-post-later": callWorkflow({ agent: "tledger", workflow: "post-later", version: "latest", input: {} }),
        dropped: outcome({ name: "dropped" }),
    },
})

/** The workflow `file`: called by a hand-off, it ends at once. Seeded active, so a call pinned to it is taken. */
export const fileGraph: TemplateGraph = defineTemplateGraph({
    key: ROUTES_FILE,
    title: { vi: ROUTES_FILE, en: ROUTES_FILE },
    input: z.object({ data: INPUT.partial().optional() }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    catalogue: {
        name: { vi: ROUTES_FILE, en: ROUTES_FILE },
        summary: { vi: ROUTES_FILE, en: ROUTES_FILE },
        version: 1,
        publishedAt: CATALOGUE_AT,
        notes: { vi: ROUTES_FILE, en: ROUTES_FILE },
        seedActive: true,
    },
    start: "filed",
    nodes: { filed: outcome({ name: "filed" }) },
})

/** The workflow that tells the person of a stored record by the record's ROUTE (E-SMALL item 2: a send addressed by a route). */
export const ROUTES_TELL = "troutes.tell"

const tellOutput = z.object({ told: z.boolean(), reason: z.string().max(80).nullable() })

/**
 * Tells the person of a record on the route the record came in on (`routeId`), with the words given: the send's receipt, or its refusal
 * as a fact. Package code names the route; the engine resolves the person and applies every rule of a send.
 */
export const tellNode = defineTemplateNode({
    id: "troutes.tell",
    title: { vi: "Báo", en: "Tell" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa],
    input: z.object({ routeId: z.string().max(200), text: z.string().max(500) }),
    output: tellOutput,
    run: async (given, ctx) => {
        const answer = await ctx.tools.call(TOOL.customerMessageSend, { routeId: given.routeId, text: given.text })
        return answer.ok ? { told: true, reason: null } : { told: false, reason: answer.refusal }
    },
    examples: [
        {
            name: "tells on the record's route",
            params: {},
            input: { routeId: "route-1", text: "Hello" },
            tools: [{ id: TOOL.customerMessageSend, args: { routeId: "route-1", text: "Hello" }, answer: toolOk({ delivered: true }, PROVIDER.zaloOa) }],
            output: { told: true, reason: null },
        },
        {
            name: "a refusal is a fact",
            params: {},
            input: { routeId: "route-1", text: "Hello" },
            tools: [{ id: TOOL.customerMessageSend, answer: toolRefused("route_held") }],
            output: { told: false, reason: "route_held" },
        },
    ],
})

/** Tells the person of a record by its route, then ends. Started directly by the worlds (a round of no person, or a customer's run). */
export const tellGraph: TemplateGraph = defineTemplateGraph({
    key: ROUTES_TELL,
    title: { vi: ROUTES_TELL, en: ROUTES_TELL },
    input: z.object({ recordRoute: z.string().max(200), text: z.string().max(500) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "tell",
    nodes: {
        tell: node(tellNode, { input: { routeId: ref("trigger.recordRoute"), text: ref("trigger.text") }, next: "told" }),
        told: outcome({ name: "told" }),
    },
})

/** The template agent: the sort primary, the file workflow, the tell workflow. */
export const ROUTES_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: ROUTES_AGENT,
    label: { vi: "Luồng", en: "Routes" },
    accounts: [PROVIDER.zaloOa],
    graphs: [sortGraph, fileGraph, tellGraph],
    primary: ROUTES_SORT,
})

/** The fixture plugin: the agent only (no tools, no effects). */
export const ROUTES_PLUGIN: Plugin = definePlugin({
    key: "troutes",
    label: { vi: "Luồng", en: "Routes" },
    templateAgents: [ROUTES_AGENT_TEMPLATE],
})

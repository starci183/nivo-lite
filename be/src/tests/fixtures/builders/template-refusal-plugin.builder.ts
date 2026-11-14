import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { PROVIDER, TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    node,
    outcome,
    ref,
    toolOk,
    toolRefused,
    trigger,
    type TemplateAgent,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

// THE REFUSAL FIXTURE PLUGIN (rulings R3 / R4): ONE small template agent whose nodes read the business answers of their calls. A call that
// asks a person, whom the person declines, answers `declined` and the node takes its other route; a native tool's business refusal
// (`other_lead`) is a fact the node routes on; an infrastructure refusal (`not_connected`) never returns: the step freezes.

// The CRM write below is a generated operation of the CRM `nivoweb` (a write: `Asking`). Its names are declared by the NIVO Web package's
// generated file, which the engine's own type check does not load, so the fixture declares the one name it calls (the same type).
declare module "@nivo-lite/agent-sdk/names" {
    interface ToolNames {
        "nivo.api.crm.nivoweb.post.services.code.renewals": import("@nivo-lite/agent-sdk/names").Asking
    }
}

/** The template agent's key: the module of its graphs. */
export const TREF_AGENT = "tref"

/** The graph whose node makes one call that asks a person first. */
export const TREF_CONFIRM = "tref.confirm"

/** The graph whose node reads an order and routes on the refusal it may answer. */
export const TREF_LOOKUP = "tref.lookup"

/** The call that asks a person (the world's door asks for it): a proposed change of the shop's truth. */
export const TREF_ASKED = TOOL.brainChangePropose

/** The read whose refusals the lookup routes on. */
export const TREF_READ = TOOL.orderGet

/** The arguments of the asked call: the same every run, so a re-run asks with the same fingerprint. */
export const TREF_PROPOSAL = {
    subject: "Giao hang",
    attribute: "Phi ship noi thanh",
    value: "35.000 d",
    reason: "Chu shop bao phi ship tang.",
}

/** The order the lookup reads. */
export const TREF_ORDER = "order-7"

/** The graph whose node writes to the CRM (an OpenAPI source), reads a member of the CRM's body, then asks a person. */
export const TREF_CRM = "tref.crm"

/** The CRM write (a generated operation of the CRM `nivoweb`, `POST /v1/services/{code}/renewals`): its success reaches the node as the CRM's body. */
export const TREF_CRM_WRITE = "nivo.api.crm.nivoweb.post.services.code.renewals"

/** Its arguments: the same every run, so the re-run makes the same call under the same key. */
export const TREF_CRM_ARGS = { code: "ACME-HOST", termMonths: 12 }

/** One template node that reads its CRM write's answer as the body (`value.id`) with what was cut beside it (`meta`). */
export const crmWriteNode = defineTemplateNode({
    id: "tref.crm-write",
    title: { vi: "Ghi CRM", en: "Write to the CRM" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TREF_CRM_WRITE, TREF_ASKED],
    mode: "auto",
    accounts: [],
    input: z.object({ leadId: z.string().max(100) }),
    output: z.object({
        id: z.string().max(500).nullable(),
        state: z.string().max(500).nullable(),
        truncated: z.boolean().nullable(),
        route: z.enum(["done", "declined"]),
    }),
    routes: { by: "route", names: ["done", "declined"] },
    run: async (_input, ctx) => {
        const written = await ctx.tools.call(TREF_CRM_WRITE, TREF_CRM_ARGS)
        if (!written.ok) return ctx.fail({ kind: "cannot", why: `crm_refused:${written.declined === true ? "declined" : written.refusal}` }, written.facts)
        const { id, state } = written.value
        const proposed = await ctx.tools.call(TREF_ASKED, TREF_PROPOSAL)
        return {
            id: typeof id === "string" ? id : null,
            state: typeof state === "string" ? state : null,
            truncated: written.meta !== undefined && "truncated" in written.meta ? written.meta.truncated : null,
            route: proposed.ok ? ("done" as const) : ("declined" as const),
        }
    },
    examples: [
        {
            name: "the CRM's body is read, then the change is filed",
            params: {},
            input: { leadId: "l1" },
            tools: [
                { id: TREF_CRM_WRITE, args: TREF_CRM_ARGS, answer: toolOk({ id: "r-1", state: "would_renew" }) },
                { id: TREF_ASKED, args: TREF_PROPOSAL, answer: toolOk({ outcome: "filed" }) },
            ],
            output: { id: "r-1", state: "would_renew", truncated: null, route: "done" },
        },
    ],
})

/** Proposes the change; a person's "no" is a business answer: the node routes to `declined` and the run goes on. */
export const confirmNode = defineTemplateNode({
    id: "tref.confirm",
    title: { vi: "\u0110\u1ec1 ngh\u1ecb \u0111\u1ed5i", en: "Propose the change" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TREF_ASKED],
    mode: "ask",
    accounts: [],
    input: z.object({ leadId: z.string().max(100) }),
    output: z.object({ route: z.enum(["done", "declined"]) }),
    routes: { by: "route", names: ["done", "declined"] },
    run: async (_input, ctx) => {
        const proposed = await ctx.tools.call(TREF_ASKED, TREF_PROPOSAL)
        if (proposed.ok) return { route: "done" as const }
        if (proposed.declined === true) return { route: "declined" as const }
        return ctx.fail({ kind: "cannot", why: `proposal_refused:${proposed.refusal}` }, proposed.facts)
    },
    examples: [
        {
            name: "the change is filed",
            params: {},
            input: { leadId: "l1" },
            tools: [{ id: TREF_ASKED, args: TREF_PROPOSAL, answer: toolOk({ outcome: "filed" }) }],
            output: { route: "done" },
        },
        {
            name: "the owner declined the approval",
            params: {},
            input: { leadId: "l1" },
            tools: [{ id: TREF_ASKED, args: TREF_PROPOSAL, answer: toolRefused("declined", { tool: TREF_ASKED }) }],
            output: { route: "declined" },
        },
    ],
})

/** Reads the order; an order of another customer is a business answer the node routes on. */
export const lookupNode = defineTemplateNode({
    id: "tref.lookup",
    title: { vi: "Xem \u0111\u01a1n", en: "Look the order up" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TREF_READ],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(2000) }),
    output: z.object({ route: z.enum(["found", "elsewhere"]) }),
    routes: { by: "route", names: ["found", "elsewhere"] },
    run: async (_input, ctx) => {
        const read = await ctx.tools.call(TREF_READ, { orderId: TREF_ORDER })
        if (read.ok) return { route: "found" as const }
        if (read.refusal === "other_lead") return { route: "elsewhere" as const }
        return ctx.fail({ kind: "cannot", why: `order_refused:${read.refusal}` }, read.facts)
    },
    examples: [
        {
            name: "the order is the customer's",
            params: {},
            input: { text: "Don cua em dau" },
            tools: [{ id: TREF_READ, args: { orderId: TREF_ORDER }, answer: toolOk({ order: { id: TREF_ORDER } }) }],
            output: { route: "found" },
        },
        {
            name: "the order is another customer's",
            params: {},
            input: { text: "Don cua em dau" },
            tools: [{ id: TREF_READ, args: { orderId: TREF_ORDER }, answer: toolRefused("other_lead", { tool: TREF_READ }) }],
            output: { route: "elsewhere" },
        },
    ],
})

const GRAPH_INPUT = z.object({ conversationId: z.string().max(500), leadId: z.string().max(500), text: z.string().max(500) })

const confirm = defineTemplateGraph({
    key: TREF_CONFIRM,
    title: { vi: "\u0110\u1ec1 ngh\u1ecb", en: "Proposal" },
    input: GRAPH_INPUT,
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    start: "confirm",
    nodes: {
        confirm: node(confirmNode, { input: { leadId: ref("trigger.leadId") }, routes: { done: "filed", declined: "kept" } }),
        filed: outcome({ name: "filed" }),
        kept: outcome({ name: "kept" }),
    },
})

const lookup = defineTemplateGraph({
    key: TREF_LOOKUP,
    title: { vi: "Xem \u0111\u01a1n", en: "Order lookup" },
    input: GRAPH_INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "lookup",
    nodes: {
        lookup: node(lookupNode, { input: { text: ref("trigger.text") }, routes: { found: "found", elsewhere: "elsewhere" } }),
        found: outcome({ name: "found" }),
        elsewhere: outcome({ name: "elsewhere" }),
    },
})

const crm = defineTemplateGraph({
    key: TREF_CRM,
    title: { vi: "Ghi CRM", en: "CRM write" },
    input: GRAPH_INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "write",
    nodes: {
        write: node(crmWriteNode, { input: { leadId: ref("trigger.leadId") }, routes: { done: "filed", declined: "kept" } }),
        filed: outcome({ name: "filed" }),
        kept: outcome({ name: "kept" }),
    },
})

/** The template agent: its three graphs, the confirm one primary. */
export const TREF_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: TREF_AGENT,
    label: { vi: "T\u1eeb ch\u1ed1i", en: "Refusals" },
    accounts: [PROVIDER.zaloOa],
    graphs: [confirm, lookup, crm],
    primary: TREF_CONFIRM,
})

/** The fixture plugin: the template agent only. */
export const TREF_PLUGIN: Plugin = definePlugin({
    key: "tref",
    label: { vi: "T\u1eeb ch\u1ed1i", en: "Refusals" },
    templateAgents: [TREF_AGENT_TEMPLATE],
})

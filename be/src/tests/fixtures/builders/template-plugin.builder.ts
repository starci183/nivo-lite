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
    ref,
    toolOk,
    trigger,
    type TemplateAgent,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { NOTE_WRITE, noteWriteEffect } from "./engine-core-plugin.builder"

// THE TEMPLATE FIXTURE PLUGIN (slice E3): ONE small template agent written with the new builders (`defineTemplateNode` /
// `defineTemplateGraph` / `defineTemplateAgent`, GraphSpec `nivo/agent-graph@2`) installed BESIDE the core, whose nodes stay
// `defineNode` ones. Two graphs, no loop: `tmpl.intake` routes on its triage's own output member (`routeBy`), and `tmpl.followup`
// decides on data (`ifNode`), hands off (`callWorkflow`) and ends on named outcomes (`outcome`).

/** The template agent's key: the module of its graphs. */
export const TMPL_AGENT = "tmpl"

/** The routed graph. */
export const TMPL_INTAKE = "tmpl.intake"

/** The graph with the data condition, the hand-off and the outcomes. */
export const TMPL_FOLLOWUP = "tmpl.followup"

/** The purpose the triage's agent is asked under (the legacy loop: `<node id>:agent`). */
export const TRIAGE_PURPOSE = "tmpl.triage:agent"

/** The read every intake run makes (a door tool: it runs again on every visit). */
export const TMPL_READ = TOOL.contactGet

/** The write the note step makes: the generic fixture's test effect (the ledger keeps it once per call key). */
export const TMPL_WRITE = NOTE_WRITE

/** The tool the rogue step calls without declaring it. */
export const TMPL_UNDECLARED = TOOL.teamMessagePost

/** Reads the customer, then asks its agent (no tool) which way the message goes: a routing node, by its own member `route`. */
export const triageNode = defineTemplateNode({
    id: "tmpl.triage",
    title: { vi: "Ph\u00e2n lo\u1ea1i", en: "Triage" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TMPL_READ],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(2000) }),
    output: z.object({ route: z.enum(["order", "question"]), summary: z.string().max(500) }),
    model: "claude-sonnet-5-5",
    routes: { by: "route", names: ["order", "question"] },
    run: async (input, ctx) => {
        await ctx.tools.call(TMPL_READ, {})
        return ctx.agent.run({
            goal: "Say whether the customer wants to order or asks a question, and sum the message up.",
            input: { text: input.text },
            output: z.object({ route: z.enum(["order", "question"]), summary: z.string().max(500) }),
            tools: [],
            maxTurns: 1,
        })
    },
    examples: [
        {
            name: "an order",
            params: {},
            input: { text: "Cho em 1 chau hoa" },
            tools: [{ id: TMPL_READ, answer: toolOk({ blocked: false }) }],
            agent: [{ answer: { route: "order", summary: "1 chau hoa" } }],
            output: { route: "order", summary: "1 chau hoa" },
        },
    ],
})

/**
 * Writes the order's stage once (the write), then reads the customer (the read); while the read says the customer is on hold the node
 * cannot go on (`ctx.fail`, the step freezes). It answers the run step's instant, so a spec sees `run.at` stay the same across re-runs.
 */
export const noteNode = defineTemplateNode({
    id: "tmpl.order-note",
    title: { vi: "Ghi \u0111\u01a1n", en: "Order note" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TMPL_WRITE, TMPL_READ],
    mode: "auto",
    accounts: [],
    input: z.object({ leadId: z.string().max(100), summary: z.string().max(500) }),
    output: z.object({ noted: z.boolean(), at: z.string().max(500) }),
    run: async (input, ctx) => {
        const written = await ctx.tools.call(TMPL_WRITE, { noteId: input.leadId, text: "close" })
        const read = await ctx.tools.call(TMPL_READ, {})
        if (read.ok && read.value["blocked"] === true) return ctx.fail({ kind: "cannot", why: "customer_on_hold" }, { leadId: input.leadId })
        return { noted: written.ok, at: ctx.run.at }
    },
    examples: [
        {
            name: "notes the order",
            params: {},
            input: { leadId: "l1", summary: "1 chau hoa" },
            tools: [
                { id: TMPL_WRITE, answer: toolOk({}) },
                { id: TMPL_READ, answer: toolOk({ blocked: false }) },
            ],
            output: { noted: true, at: "2026-01-05T09:00:00.000+07:00" },
        },
    ],
})

/** Calls a tool it does not declare: the engine refuses the call (`TOOL_UNDECLARED`) and the step freezes. */
export const rogueNode = defineTemplateNode({
    id: "tmpl.rogue",
    title: { vi: "Sai c\u00f4ng c\u1ee5", en: "Rogue" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TMPL_READ],
    mode: "auto",
    accounts: [],
    input: z.object({ summary: z.string().max(500) }),
    output: z.object({ answered: z.boolean() }),
    run: async (input, ctx) => {
        // A valid name the node does not declare (tsc takes any tool id; the engine refuses it at the call).
        await ctx.tools.call(TMPL_UNDECLARED, { text: input.summary })
        return { answered: true }
    },
    examples: [{ name: "never answers", params: {}, input: { summary: "x" }, failure: { kind: "cannot", why: "x" } }],
})

const intake = defineTemplateGraph({
    key: TMPL_INTAKE,
    title: { vi: "Ti\u1ebfp nh\u1eadn", en: "Intake" },
    // The generic scope of a channel message: the person's WORDS are the engine's own line (R26), not part of the event; the triage reads its key.
    input: z.object({ eventId: z.string().max(500), routeId: z.string().max(500), contactId: z.string().max(500), data: z.object({ messageKey: z.string().max(500) }) }),
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    start: "triage",
    nodes: {
        triage: node(triageNode, { input: { text: ref("trigger.data.messageKey") }, routes: { order: "note", question: "rogue" } }),
        note: node(noteNode, {
            input: { leadId: ref("trigger.contactId"), summary: ref("steps.triage.output.summary") },
            next: "noted",
        }),
        rogue: node(rogueNode, { input: { summary: ref("steps.triage.output.summary") } }),
        noted: outcome({ name: "noted", output: { at: ref("steps.note.output.at") } }),
    },
})

const followup = defineTemplateGraph({
    key: TMPL_FOLLOWUP,
    title: { vi: "Theo d\u00f5i", en: "Follow-up" },
    input: z.object({ conversationId: z.string().max(500), leadId: z.string().max(500), text: z.string().max(500), urgent: z.boolean() }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "check",
    nodes: {
        check: ifNode({ when: { ref: ref("trigger.urgent"), op: "eq", value: true }, yes: "handoff", no: "quiet" }),
        handoff: callWorkflow({
            agent: TMPL_AGENT,
            workflow: "intake",
            input: { conversationId: ref("trigger.conversationId"), leadId: ref("trigger.leadId"), text: ref("trigger.text") },
            next: "handed",
        }),
        handed: outcome({ name: "handed", output: { text: ref("trigger.text") } }),
        quiet: outcome({ name: "quiet" }),
    },
})

/** The template agent: its two graphs, the routed one primary. */
export const TMPL_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: TMPL_AGENT,
    label: { vi: "M\u1eabu", en: "Template" },
    accounts: [PROVIDER.zaloOa],
    graphs: [intake, followup],
    primary: TMPL_INTAKE,
})

/** The fixture plugin: the template agent only (its nodes are added by the installation from its graphs). */
export const TMPL_PLUGIN: Plugin = definePlugin({
    key: "tmpl",
    label: { vi: "M\u1eabu", en: "Template" },
    templateAgents: [TMPL_AGENT_TEMPLATE],
    effects: [noteWriteEffect],
})

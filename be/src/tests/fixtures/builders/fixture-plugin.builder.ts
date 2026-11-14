import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { defineModule, type ModuleDeclaration, type ModuleServer } from "@nivo-lite/agent-sdk/module"
import { defineEffect, defineNode, type EffectDefinition, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { parseWorkflowTemplate, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"

/** The key of the fixture plugin's one module. */
export const FIXTURE_MODULE = "fixdesk"

/** The enterprise identifier the fixture plugin belongs to. */
export const FIXTURE_ENTERPRISE = "fixture-co"

/** The fixture plugin's own tool: an effect no other plugin declares. */
export const FIXTURE_TOOL = "fixdesk.ticket.open"

/** The guidance the fixture agent declares, in both languages. */
export const FIXTURE_GUIDANCE = { vi: "Mo phieu truoc, tra loi sau.", en: "Open a ticket first, answer after." }

/** The words the fixture plugin gives the model for the title of its own tool. */
export const FIXTURE_TOOL_WORDS = "Opens a support ticket for the customer of the run"

const ticketOpen: EffectDefinition = defineEffect({
    id: FIXTURE_TOOL,
    title: { key: "fixdeskTicketOpen" },
    payload: z.object({ subject: z.string().max(200) }),
})

/** A step that opens a ticket (its own tool) and tells the team (a core tool the agent reuses); it answers what it was given. */
const intake: NodeDefinition = defineNode({
    id: "fixdesk.intake",
    role: "execute",
    title: { key: "fixdeskIntake" },
    params: z.object({}),
    input: z.object({ subject: z.string().max(200) }),
    output: z.object({ opened: z.string().max(200) }),
    effects: [FIXTURE_TOOL, TOOL.teamMessagePost],
    run: (input) => Promise.resolve({ opened: input.subject }),
    examples: [{ name: "one", params: {}, input: { subject: "s" }, output: { opened: "s" }, effects: [] }],
})

/** A step that reaches a core tool OUTSIDE the fixture agent's set: a workflow that uses it is refused. */
const overreach: NodeDefinition = defineNode({
    id: "fixdesk.overreach",
    role: "execute",
    title: { key: "fixdeskOverreach" },
    params: z.object({}),
    input: z.object({}),
    output: z.object({}),
    effects: [TOOL.agentTag],
    run: () => Promise.resolve({}),
    examples: [{ name: "one", params: {}, input: {}, output: {}, effects: [] }],
})

const declaration: ModuleDeclaration = defineModule({
    key: FIXTURE_MODULE,
    namespace: FIXTURE_MODULE,
    permissions: [],
    reads: [],
    actions: [],
    specs: [],
    agent: {
        tools: [TOOL.teamMessagePost, FIXTURE_TOOL],
        abilities: { kinds: { messaging: { "customer.send": "ask" } } },
    },
})

/** The catalogue template of the fixture module: the shape of a shipped one, written out under the fixture's own key, handle and names. */
const server = (): ModuleServer => ({
    key: FIXTURE_MODULE,
    template: {
        key: FIXTURE_MODULE,
        order: 9000,
        name: { vi: "Ban ho tro", en: "Help desk" },
        shortName: { vi: "Ho tro", en: "Desk" },
        description: { vi: "Mot ban ho tro thu", en: "A fixture help desk" },
        points: { vi: ["Mo phieu"], en: ["Opens tickets"] },
        purpose: "Opens a support ticket for the customer of the run.",
        icon: "saved",
        glyph: "M5 5h14v15H5z",
        mascot: "/images/promo/mascot-point.png",
        category: "operations",
        status: "early",
        audience: "customer",
        includedWithWorkspace: false,
        available: true,
        knowledgeFolder: FIXTURE_MODULE,
        workbench: null,
        settingsExtras: null,
        requires: { capabilities: ["customer_chat"], connections: [] },
        connectionProviders: ["telegram"],
        defaultOperatingMode: "assist",
        multiInstance: false,
        agent: {
            label: { vi: "Ho tro", en: "Desk" },
            handle: FIXTURE_MODULE,
            summary: { vi: "Mo phieu ho tro", en: "Opens support tickets" },
            capabilities: { vi: ["Mo phieu"], en: ["Open tickets"] },
            role: { vi: "Nhan vien ho tro", en: "Support agent" },
            instructions: { vi: "Mo phieu truoc, tra loi sau.", en: "Open a ticket first, answer after." },
        },
        gates: [
            {
                key: "hours",
                label_vi: "Gio ho tro",
                label_en: "Support hours",
                hint_vi: "Doi ho tro lam viec luc nao",
                hint_en: "When the desk works",
            },
        ],
    },
})

/** The graph of a fixture workflow: one step of the given node. */
const graphOf = (step: string): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: FIXTURE_MODULE,
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [FIXTURE_TOOL, TOOL.teamMessagePost] },
    nodes: [{ key: "step", kind: "execute", step, params: {} }],
})

const templateOf = (slug: string, primary: boolean, step: string): WorkflowTemplate =>
    parseWorkflowTemplate({
        id: `${FIXTURE_MODULE}.${slug}`,
        moduleKey: FIXTURE_MODULE,
        primary,
        name: { vi: `Quy trinh ${slug}`, en: `Workflow ${slug}` },
        summary: { vi: "Mau thu", en: "A fixture" },
        requires: [],
        shops: 0,
        versions: [
            {
                version: 1,
                publishedAt: "2026-11-11T00:00:00.000Z",
                changes: [{ vi: "Ban dau", en: "First version" }],
                graph: graphOf(step),
            },
        ],
    })

/** The primary workflow of the fixture module, and its secondary one. */
export const FIXTURE_PRIMARY: WorkflowTemplate = templateOf("ticket", true, "fixdesk.intake")
export const FIXTURE_SECONDARY: WorkflowTemplate = templateOf("followup", false, "fixdesk.intake")

/** A workflow of the fixture module whose step reaches a tool outside its agent's set. */
export const FIXTURE_OVERREACH_GRAPH: GraphSpec = graphOf("fixdesk.overreach")

/**
 * A tiny PRIVATE plugin, made the way a plugin package is (`definePlugin`): one module with an agent (two tools: a core tool it reuses
 * and one of its own), two nodes, a primary and a secondary workflow template, the words of its tool, a declared tool mode and a node
 * model. It belongs to the enterprise `fixture-co`. Tests put it in the installation's array beside the core plugin.
 */
export const FIXTURE_PLUGIN: Plugin = definePlugin({
    key: "fixture",
    label: { vi: "Thu", en: "Fixture" },
    visibility: "private",
    enterprises: [FIXTURE_ENTERPRISE],
    modules: [declaration],
    servers: [server()],
    nodes: [intake, overreach],
    effects: [ticketOpen],
    toolLabels: {
        [FIXTURE_TOOL]: {
            kind: "acts",
            title: { vi: "Mo phieu", en: "Open a ticket" },
            summary: { vi: "Mo mot phieu ho tro.", en: "Opens a support ticket." },
        },
    },
    templates: [FIXTURE_PRIMARY, FIXTURE_SECONDARY],
    nodeModels: { "fixdesk.intake": { model: "auto", weight: "light" } },
    guidance: (moduleKey, locale) => (moduleKey === FIXTURE_MODULE ? `POLICY: ${FIXTURE_GUIDANCE[locale]}` : ""),
    words: (key) => (key === "fixdeskTicketOpen" ? FIXTURE_TOOL_WORDS : undefined),
})

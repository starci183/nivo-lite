import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    BY_HAND_DRAIN,
    ENGINE_DRAIN,
    HISTORY_STORES,
    RESEED_STORES,
    oldIdCountIn,
    oldIdsOf,
    sameGraph,
    toolRenameMapOf,
    workflowCountsOf,
    workflowReseedOf,
    type CurrentTemplate,
    type HeldWorkflow,
    type PrimaryStanding,
    type WorkflowReseedAction,
} from "./tool-reseed.policy"

/** A graph of one step that names `tool` in its grant. */
const graphOf = (step: string, tool = "nivo.tool.customer.message.send"): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [tool], effects: [] },
    nodes: [{ key: "end", kind: "output", step }],
})

const OLD = new Set(["acme.lead.message.send", "acme.order.create"])

const TEMPLATES: ReadonlyArray<CurrentTemplate> = [
    { id: "sales.main", primary: true, version: 7, graph: graphOf("sales.reply") },
    { id: "sales.round", primary: false, version: 4, graph: graphOf("sales.round") },
]

const workflowOf = (over: Partial<HeldWorkflow>): HeldWorkflow => ({
    id: "w",
    primary: false,
    status: "active",
    latestNumber: 2,
    template: { templateId: "sales.round", templateVersion: 4 },
    running: graphOf("sales.round"),
    ...over,
})

const FLOW: PrimaryStanding = { runsFlow: true, holdsCurrent: true }

describe("workflowReseedOf", () => {
    const cases: ReadonlyArray<{
        readonly name: string
        readonly held: HeldWorkflow
        readonly standing?: PrimaryStanding
        readonly action: WorkflowReseedAction
        readonly toTemplateId?: string
        readonly toVersion: number | null
        readonly oldIds: number
    }> = [
        { name: "a workflow on its template's current graph", held: workflowOf({}), action: "current", toVersion: null, oldIds: 0 },
        {
            name: "a workflow on another graph of an installed template",
            held: workflowOf({ running: graphOf("sales.round-old", "acme.lead.message.send") }),
            action: "replace",
            toTemplateId: "sales.round",
            toVersion: 4,
            oldIds: 1,
        },
        {
            name: "a workflow whose graph no longer reads",
            held: workflowOf({ running: null }),
            action: "replace",
            toTemplateId: "sales.round",
            toVersion: 4,
            oldIds: 0,
        },
        {
            name: "a workflow on its template's current graph under an older template version (the link moves)",
            held: workflowOf({ template: { templateId: "sales.round", templateVersion: 3 } }),
            action: "replace",
            toTemplateId: "sales.round",
            toVersion: 4,
            oldIds: 0,
        },
        {
            name: "an active workflow of a template the installation no longer ships",
            held: workflowOf({ template: { templateId: "sales.gone", templateVersion: 2 } }),
            action: "pause",
            toVersion: null,
            oldIds: 0,
        },
        {
            name: "a paused workflow of a template that is gone",
            held: workflowOf({ status: "paused", template: { templateId: "sales.gone", templateVersion: 2 } }),
            action: "orphan",
            toVersion: null,
            oldIds: 0,
        },
        {
            name: "a workflow made from scratch",
            held: workflowOf({ template: null, running: graphOf("x", "acme.order.create") }),
            action: "orphan",
            toVersion: null,
            oldIds: 1,
        },
        {
            name: "the primary workflow already on the current flow",
            held: workflowOf({ primary: true, running: graphOf("sales.reply") }),
            action: "current",
            toVersion: null,
            oldIds: 0,
        },
        {
            name: "the primary workflow on an older flow",
            held: workflowOf({ primary: true, running: graphOf("sales.reply-old") }),
            action: "republish",
            toVersion: 7,
            oldIds: 0,
        },
        {
            name: "the primary workflow of an agent whose live spec is another flow",
            held: workflowOf({ primary: true, running: graphOf("sales.reply") }),
            standing: { runsFlow: true, holdsCurrent: false },
            action: "republish",
            toVersion: 7,
            oldIds: 0,
        },
        {
            name: "the primary workflow of an agent that runs no flow (its setup writes the rules)",
            held: workflowOf({ primary: true, running: graphOf("sales.reply-old") }),
            standing: { runsFlow: false, holdsCurrent: false },
            action: "waits",
            toVersion: null,
            oldIds: 0,
        },
    ]

    it.each(cases)("$name: $action", ({ held, standing, action, toTemplateId, toVersion, oldIds }) => {
        expect(workflowReseedOf([held], TEMPLATES, standing ?? FLOW, OLD)).toEqual([
            {
                workflowId: "w",
                templateId: held.template?.templateId ?? null,
                primary: held.primary,
                action,
                toTemplateId: toTemplateId ?? null,
                toVersion,
                latestNumber: 2,
                oldIds,
            },
        ])
    })

    it("carries a workflow onto the successor a declared map names, and pauses it when no successor is shipped", () => {
        const renamed = workflowOf({ template: { templateId: "sales.round-old", templateVersion: 9 } })
        const successors = new Map([["sales.round-old", "sales.round"]])
        const [carried] = workflowReseedOf([renamed], TEMPLATES, FLOW, OLD, successors)
        expect(carried).toMatchObject({ action: "replace", templateId: "sales.round-old", toTemplateId: "sales.round", toVersion: 4 })
        const [paused] = workflowReseedOf([renamed], TEMPLATES, FLOW, OLD)
        expect(paused?.action).toBe("pause")
    })

    it("names the primary workflow of a module with no primary template an orphan", () => {
        const [plan] = workflowReseedOf([workflowOf({ primary: true })], TEMPLATES.slice(1), FLOW, OLD)
        expect(plan?.action).toBe("orphan")
    })
})

describe("oldIdCountIn", () => {
    it.each([
        { json: "acme.lead.message.send", count: 1 },
        { json: "acme.lead.message.send.extra", count: 0 },
        { json: ["acme.order.create", { a: "acme.lead.message.send" }], count: 2 },
        { json: { "acme.order.create": "auto", nested: { "acme.lead.message.send": "acme.order.create" } }, count: 3 },
        { json: { lead: "lead.address", n: 3, b: true, z: null }, count: 0 },
    ])("counts exact ids only in $json: $count", ({ json, count }) => {
        expect(oldIdCountIn(json, OLD)).toBe(count)
    })
})

describe("the rename map", () => {
    it("reads the tools table and leaves out a key that is also a successor", () => {
        const map = toolRenameMapOf({ about: "x", tools: { "a.b": "nivo.tool.a.b", "nivo.tool.a.b": "nivo.tool.a.b" } })
        expect(map === null ? null : [...oldIdsOf(map)]).toEqual(["a.b"])
    })

    it.each([null, {}, { tools: [] }, { tools: { a: 3 } }])("refuses %p", (json) => {
        expect(toolRenameMapOf(json)).toBeNull()
    })

    it("takes a table of 2000 renames and ids of 200 characters, and refuses one more rename or a longer id", () => {
        const table = (count: number): Record<string, string> => Object.fromEntries(Array.from({ length: count }, (_, index) => [`old.${String(index)}`, "nivo.tool.x"]))
        expect(toolRenameMapOf({ tools: table(2000) })).not.toBeNull()
        expect(toolRenameMapOf({ tools: table(2001) })).toBeNull()
        expect(toolRenameMapOf({ tools: { ["o".repeat(200)]: "n".repeat(200) } })).not.toBeNull()
        expect(toolRenameMapOf({ tools: { ["o".repeat(201)]: "n" } })).toBeNull()
        expect(toolRenameMapOf({ tools: { o: "n".repeat(201) } })).toBeNull()
    })
})

describe("sameGraph", () => {
    it("is blind to the order of keys and sees every value", () => {
        expect(sameGraph({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
        expect(sameGraph({ a: 1, b: { c: [2, 1] } }, { b: { c: [1, 2] }, a: 1 })).toBe(false)
    })
})

describe("workflowCountsOf", () => {
    it("counts replaced, republished, paused and added as rewritten, orphans apart, nothing removed", () => {
        const actions: ReadonlyArray<WorkflowReseedAction> = ["current", "replace", "republish", "pause", "orphan", "waits"]
        const plans = actions.map((action, at) => ({
            workflowId: `w${at}`,
            templateId: "t",
            primary: action === "republish" || action === "waits",
            action,
            toTemplateId: null,
            toVersion: null,
            latestNumber: 1,
            oldIds: 0,
        }))
        expect(workflowCountsOf(plans, 2)).toEqual({
            workflows: { found: 6, rewritten: 5, removed: 0, orphans: 1 },
            graphs: { found: 2, rewritten: 1, removed: 0, orphans: 0 },
        })
    })
})

describe("the stores", () => {
    it("are exactly the three stores of the verb, none of them a history store", () => {
        expect(RESEED_STORES).toEqual(["workflows", "graphs", "tool_grants"])
        expect(HISTORY_STORES.some((store) => new Set<string>(RESEED_STORES).has(store))).toBe(false)
    })

    // Ledger (ROAD Opus-1d, 2026-11-14): `holds` (public.conversation_holds) left the by-hand list with the table (ruling R35).
    it("read every condition of block 0: two records through the engine, nine tables by hand", () => {
        expect(ENGINE_DRAIN.map((condition) => condition.key)).toEqual(["runs", "steps"])
        expect(BY_HAND_DRAIN.map((line) => line.split(":")[0])).toEqual([
            "jobs",
            "outbox",
            "wakes",
            "approvals",
            "work_items",
            "threads",
            "care_timers",
            "stops",
            "freezes",
        ])
    })
})

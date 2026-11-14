import { PROVIDER, TOOL, TRIGGER, crmProviderKeyOf } from "@nivo-lite/agent-sdk/names"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpecV2, GraphV2Step } from "@nivo-lite/agent-sdk/graph"
import { TMPL_AGENT_TEMPLATE, TMPL_WRITE, noteNode, rogueNode, triageNode } from "@tests/fixtures/builders/template-plugin.builder"
import { LOOP_AGENT_TEMPLATE, markNode, sideNode, tallyNode } from "@tests/fixtures/builders/template-loop-plugin.builder"
import { PROVIDER_CATALOGUE } from "@modules/domain/tools"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import {
    SOURCE_ACCOUNT_KIND,
    TEMPLATE_IF_STEP,
    TEMPLATE_UNTIL_STEP,
    accountKindOf,
    graphOfSpecV2,
    workflowTemplateOfGraph,
} from "./template-graph-adapter.policy"
import { INSTALLED } from "./installed.policy"
import { sourcesOfVerb } from "./template-triggers.policy"

const templateNodes = [triageNode, noteNode, rogueNode]
const lookups = {
    legacyNodeOf: (id: string) => INSTALLED.nodeInstall().nodes.find((node) => node.id === id),
    templateNodeOf: (id: string) => templateNodes.find((node) => node.id === id),
}
const [intake, followup] = TMPL_AGENT_TEMPLATE.graphs

describe("graphOfSpecV2", () => {
    it("reads a routed @2 graph as the engine's graph: flat steps, roles from kind, the derived envelope", () => {
        expect(intake).toBeDefined()
        if (intake === undefined) return
        const flow = graphOfSpecV2(intake.spec, lookups)
        expect(graphSpecSchema.safeParse(flow).success).toBe(true)
        expect(flow.nodes.map((node) => [node.key, node.kind, node.step])).toEqual([
            ["triage", "condition", "tmpl.triage"],
            ["note", "execute", "tmpl.order-note"],
            ["rogue", "execute", "tmpl.rogue"],
            ["noted", "output", "core.outcome"],
        ])
        expect(flow.nodes[0]).toMatchObject({ model: "claude-sonnet-5-5", params: { text: { $ref: "trigger.data.messageKey" } } })
        expect(flow.triggers).toEqual([{ key: "t1", source: { kind: "zalo", connectionId: null } }])
        expect(flow.trigger).toEqual({ kind: "tag", sources: ["channel"] })
        expect(flow.grant).toEqual({ tools: [TOOL.contactGet, TMPL_WRITE].sort(), effects: [] })
        expect(flow.entry).toEqual({ openTo: "any" })
    })

    it("keeps every option of a ref (`default`, `round`): a dropped `round` would hand round 2 the input of round 1", () => {
        expect(intake).toBeDefined()
        if (intake === undefined) return
        const withOptions = { $ref: "steps.triage.output", default: "none", round: "previous" } as const
        const nodes = intake.spec.nodes.map((step): GraphV2Step =>
            step.kind === "node" && step.key === "triage" ? { ...step, params: { ...step.params, text: withOptions } } : step,
        ) as unknown as GraphSpecV2["nodes"]
        const flow = graphOfSpecV2({ ...intake.spec, nodes }, lookups)
        expect(flow.nodes[0]?.params).toMatchObject({ text: { $ref: "steps.triage.output", default: "none", round: "previous" } })
    })

    it("reads an ifNode as the engine's if, a hand-off and the outcomes with the old control nodes' params and grant", () => {
        expect(followup).toBeDefined()
        if (followup === undefined) return
        const flow = graphOfSpecV2(followup.spec, lookups)
        expect(graphSpecSchema.safeParse(flow).success).toBe(true)
        expect(flow.nodes[0]).toEqual({
            key: "check",
            kind: "condition",
            step: TEMPLATE_IF_STEP,
            params: { when: { ref: { $ref: "trigger.urgent", default: null }, op: "eq", value: true } },
            routes: { yes: "handoff", no: "quiet" },
        })
        expect(flow.nodes[1]).toMatchObject({
            step: "core.call-workflow",
            kind: "output",
            params: { agent: "tmpl", workflow: "intake", version: "latest", inputs: { text: { $ref: "trigger.text" } } },
            next: "handed",
        })
        expect(flow.triggers?.map((one) => one.source.kind)).toEqual(["workflow"])
        expect(flow.trigger.sources).toEqual(["agent"])
        expect(flow.grant.effects).toEqual([TOOL.agentTag])
        expect(flow.entry).toEqual({ openTo: "agent" })
    })

    it("installs a graph as a workflow template at one version, primary when it is the agent's primary", () => {
        expect([intake, followup]).not.toContain(undefined)
        if (intake === undefined || followup === undefined) return
        const messages = () => null
        const template = workflowTemplateOfGraph(TMPL_AGENT_TEMPLATE, intake, { ...lookups, messages })
        expect(template).toMatchObject({ id: "tmpl.intake", moduleKey: "tmpl", primary: true, name: { vi: "Ti\u1ebfp nh\u1eadn", en: "Intake" } })
        expect(template.versions.map((version) => version.version)).toEqual([1])
        expect(workflowTemplateOfGraph(TMPL_AGENT_TEMPLATE, followup, { ...lookups, messages }).primary).toBe(false)
    })

    it("carries the graph catalogue's `seedActive` to the install road, and nothing when the graph does not say", () => {
        expect(followup).toBeDefined()
        if (followup === undefined) return
        const messages = () => null
        const catalogue = {
            name: { vi: "Theo d\u00f5i", en: "Follow-up" },
            summary: { vi: "Theo d\u00f5i", en: "Follow-up" },
            version: 1,
            publishedAt: "2026-11-12T00:00:00.000Z",
            notes: { vi: "M\u1edbi", en: "New" },
        }
        const active = { ...followup, spec: { ...followup.spec, catalogue: { ...catalogue, seedActive: true } } }
        const quiet = { ...followup, spec: { ...followup.spec, catalogue } }
        expect(workflowTemplateOfGraph(TMPL_AGENT_TEMPLATE, active, { ...lookups, messages }).seedActive).toBe(true)
        expect(workflowTemplateOfGraph(TMPL_AGENT_TEMPLATE, quiet, { ...lookups, messages })).not.toHaveProperty("seedActive")
        expect(workflowTemplateOfGraph(TMPL_AGENT_TEMPLATE, followup, { ...lookups, messages })).not.toHaveProperty("seedActive")
    })
})

describe("the trigger verbs of today's sources", () => {
    // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12: one source per STREAM): `sourcesOfVerb` takes the trigger's
    // provider list again (T1 had cut it to one account); a list's sources are the union of each provider's, in the list's order.
    it("maps a verb and its providers to the sources of today through the trigger registry, the engine road with none", () => {
        // R6: each channel's verb registers on its own channel's source only; a provider of another channel (or Meta) adds none.
        expect(sourcesOfVerb(TRIGGER.zaloMessageReceived, [PROVIDER.zaloOa])).toEqual([{ kind: "zalo", connectionId: null }])
        expect(sourcesOfVerb(TRIGGER.zaloMessageReceived, [PROVIDER.telegram])).toEqual([])
        expect(sourcesOfVerb(TRIGGER.zaloMessageReceived, [PROVIDER.meta])).toEqual([])
        expect(sourcesOfVerb(TRIGGER.telegramMessageReceived, [PROVIDER.telegram])).toEqual([{ kind: "telegram", connectionId: null }])
        expect(sourcesOfVerb(TRIGGER.websiteMessageReceived, undefined)).toEqual([{ kind: "website", connectionId: null }])
        // Ledger (the core `sepay` source left the trigger registry): SePay is carried by its provider trigger only, as every feed is.
        expect(sourcesOfVerb(TRIGGER.paymentCreditReceived, [PROVIDER.sepay])).toEqual([
            { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
        ])
        expect(sourcesOfVerb(TRIGGER.paymentCreditReceived, [PROVIDER.casso])).toEqual([
            { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
        ])
        expect(sourcesOfVerb(TRIGGER.paymentCreditReceived, [PROVIDER.sepay, PROVIDER.casso])).toEqual([
            { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
            { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
        ])
        expect(sourcesOfVerb(TRIGGER.paymentCreditReceived, undefined)).toEqual([])
        expect(sourcesOfVerb(TRIGGER.mailMessageReceived, [PROVIDER.imap])).toEqual([
            { kind: "provider", connectionId: null, provider: "imap", trigger: "mail.received" },
        ])
        expect(sourcesOfVerb(TRIGGER.clockTick, undefined)).toEqual([{ kind: "schedule", connectionId: null }])
        expect(sourcesOfVerb(TRIGGER.workflowCalled, undefined)).toEqual([{ kind: "workflow", connectionId: null }])
    })

    it("derives one registration per source of every listed provider (bound to the workspace's accounts at run time, one per stream)", () => {
        const credit = (accounts: GraphSpecV2["triggers"][number]["accounts"]): GraphSpecV2 => ({
            ...intake.spec,
            triggers: [{ verb: TRIGGER.paymentCreditReceived, ...(accounts === undefined ? {} : { accounts }) }],
        })
        const credits = [{ param: "data.direction", op: "equals", value: "in" }]
        expect(graphOfSpecV2(credit([PROVIDER.sepay, PROVIDER.casso]), lookups).triggers).toEqual([
            {
                key: "t1",
                source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
                conditions: credits,
            },
            {
                key: "t1-2",
                source: { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
                conditions: credits,
            },
        ])
        expect(graphOfSpecV2(credit([PROVIDER.casso]), lookups).triggers).toEqual([
            {
                key: "t1",
                source: { kind: "provider", connectionId: null, provider: "casso", trigger: "transaction.received" },
                conditions: credits,
            },
        ])
    })

    it("installs the shipped credit graphs on the feeds they read and the mail triage on the mailbox provider once", () => {
        const sourcesOf = (key: string) => INSTALLED.templateGraphOf(key)?.graph.spec.triggers
        const creditOf = (key: string) => sourcesOf(key)?.find((entry) => entry.verb === TRIGGER.paymentCreditReceived)?.accounts
        expect(creditOf("webbooks.payment")).toEqual([PROVIDER.sepay, PROVIDER.casso])
        // The shop sale's money in reads the one credit by its row on every bank feed (its credit-read node takes SePay, Casso and PayOS).
        expect(creditOf("sales.payment")).toEqual([PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos])
        expect(sourcesOf("webmail.triage")?.find((entry) => entry.verb === TRIGGER.mailMessageReceived)?.accounts).toEqual([
            PROVIDER.imap,
        ])
    })
})

describe("the words of the control steps on the map (R68: G-SLIM's labels), carried to @1", () => {
    // E-FIX7: G-SLIM gave the slim package graphs LABELS on their control steps (if / wait / loop / hand-back / outcome) and the words of
    // an until loop's two ways out (`exits`); the adapter dropped them, so the map read the package's generic words. Read from the REAL
    // installed slim sale (`sales.consult` v30) and every other installed graph: what the @2 step says, the @1 node says, as written.
    const real = {
        legacyNodeOf: (id: string) => INSTALLED.nodeInstall().nodes.find((node) => node.id === id),
        templateNodeOf: (id: string) => INSTALLED.templateNodeOf(id) ?? undefined,
    }
    const consult = INSTALLED.templateGraphOf("sales.consult")?.graph.spec

    it("the slim sale: the pay loop's label and its two exits, the talk loop's, an if's question, a wait's, a hand-back's and an outcome's", () => {
        expect(consult).toBeDefined()
        if (consult === undefined) return
        const flow = graphOfSpecV2(consult, real)
        expect(graphSpecSchema.safeParse(flow).success).toBe(true)
        const nodeOf = (key: string) => flow.nodes.find((node) => node.key === key)
        expect(nodeOf("pay")).toMatchObject({
            step: TEMPLATE_UNTIL_STEP,
            exits: { until: { vi: "Thoát khi đơn đã trả" }, exhausted: { vi: "Hết 6 vòng mà chưa trả" } },
        })
        expect(nodeOf("pay")?.label).toBeDefined()
        expect(nodeOf("talk")).toMatchObject({ step: TEMPLATE_UNTIL_STEP, label: { vi: "Tư vấn", en: "Consult" } })
        expect(nodeOf("opening")).toMatchObject({ step: TEMPLATE_IF_STEP, label: { vi: "Vòng đầu?", en: "First round?" } })
        expect(nodeOf("exact")).toMatchObject({ label: { vi: "Đủ tiền?" } })
        expect(nodeOf("hear")).toMatchObject({ label: { vi: "Chờ khách nhắn", en: "Wait for the customer's message" } })
        expect(nodeOf("give-back-talk")).toMatchObject({ label: { vi: "Trả lại tin", en: "Hand the message back" } })
        expect(nodeOf("declined")).toMatchObject({ step: "core.outcome", label: { vi: "Bị từ chối", en: "Declined" } })
        // A node step carries no label: its node's title names it.
        const nodeSteps = new Set(consult.nodes.filter((step) => step.kind === "node").map((step) => step.key))
        expect(flow.nodes.filter((node) => nodeSteps.has(node.key) && node.label !== undefined)).toEqual([])
    })

    it("every installed @2 graph: each control step's label and an until loop's exits reach its @1 node unchanged", () => {
        const graphs = INSTALLED.templateAgents().flatMap((agent) => agent.graphs)
        expect(graphs.length).toBeGreaterThan(0)
        const carried = graphs.flatMap((graph) => {
            const flow = graphOfSpecV2(graph.spec, real)
            return graph.spec.nodes.flatMap((step) => {
                const node = flow.nodes.find((one) => one.key === step.key)
                const label = "label" in step ? step.label : undefined
                const exits = "exits" in step ? step.exits : undefined
                return [
                    ...(label === undefined ? [] : [[graph.key, step.key, "label", node?.label === label]]),
                    ...(exits === undefined ? [] : [[graph.key, step.key, "exits", node?.exits === exits]]),
                ]
            })
        })
        expect(carried.length).toBeGreaterThan(0)
        expect(carried.filter(([, , , same]) => same !== true)).toEqual([])
    })
})

describe("a @2 loop over a list as the engine's loop node", () => {
    const loopLookups = {
        legacyNodeOf: (id: string) => INSTALLED.nodeInstall().nodes.find((one) => one.id === id),
        templateNodeOf: (id: string) => [sideNode, markNode, tallyNode].find((one) => one.id === id),
    }
    const [round] = LOOP_AGENT_TEMPLATE.graphs

    it("runs on the registered `core.for-each` with its list, cap, collect, key and `concurrency` as written", () => {
        expect(round).toBeDefined()
        if (round === undefined) return
        const flow = graphOfSpecV2(round.spec, loopLookups)
        expect(graphSpecSchema.safeParse(flow).success).toBe(true)
        expect(flow.nodes.find((one) => one.key === "each")).toEqual({
            key: "each",
            kind: "execute",
            step: "core.for-each",
            params: { items: { $ref: "trigger.orders" }, max: 50, collect: "mark", itemKey: "orderId", concurrency: 1 },
            routes: { body: "gate" },
            next: "tally",
        })
        const fan = (one: GraphV2Step): GraphV2Step =>
            one.kind === "loop" && one.params.mode === "over" ? { ...one, params: { ...one.params, concurrency: 3 } } : one
        const [first, ...rest] = round.spec.nodes
        const fanned: GraphSpecV2 = { ...round.spec, nodes: [fan(first), ...rest.map(fan)] }
        expect(graphOfSpecV2(fanned, loopLookups).nodes.find((one) => one.key === "each")?.params).toMatchObject({ concurrency: 3 })
    })
})

describe("a node step's providers and its ONE mode, carried as the engine's `@1` members", () => {
    it("keeps each provider in the step's order, its provider as the node names it, its kind, no connection, no operations; the step's mode on the node", () => {
        const spec: GraphSpecV2 | undefined = intake?.spec
        expect(spec).toBeDefined()
        if (spec === undefined) return
        const step = spec.nodes.find((one): one is Extract<GraphV2Step, { kind: "node" }> => one.kind === "node")
        expect(step).toBeDefined()
        if (step === undefined) return
        const withAccounts: GraphV2Step = { ...step, mode: "ask", accounts: [PROVIDER.telegram, PROVIDER.zaloOa] }
        const [first, ...rest] = spec.nodes.map((one) => (one === step ? withAccounts : one))
        expect(first).toBeDefined()
        if (first === undefined) return
        const accounted: GraphSpecV2 = { ...spec, nodes: [first, ...rest] }

        const flow = graphOfSpecV2(accounted, lookups)

        expect(graphSpecSchema.safeParse(flow).success).toBe(true)
        const node = flow.nodes.find((one) => one.key === step.key)
        expect(node?.mode).toBe("ask")
        expect(node?.accounts).toEqual([
            { kind: "messaging", provider: "telegram", connectionId: null },
            { kind: "messaging", provider: "zalo_oa", connectionId: null },
        ])
    })

    it("writes the mode of every node step (a step of NIVO's own tools lists no provider), and neither member on a control step", () => {
        expect(intake).toBeDefined()
        if (intake === undefined) return
        const flow = graphOfSpecV2(intake.spec, lookups)
        expect(flow.nodes.map((node) => [node.key, node.mode, node.accounts])).toEqual([
            ["triage", "auto", []],
            ["note", "auto", []],
            ["rogue", "auto", []],
            ["noted", undefined, undefined],
        ])
        for (const step of intake.spec.nodes) if (step.kind === "node") expect([step.key, step.accounts]).toEqual([step.key, []])
    })

    it("gives each provider the kind the engine's catalogue gives it; a source key the OpenAPI provider's", () => {
        for (const spec of PROVIDER_CATALOGUE.filter((one) => one.provider !== OPENAPI_PROVIDER)) {
            expect([spec.provider, accountKindOf(spec.provider)]).toEqual([spec.provider, spec.kind])
        }
        expect(PROVIDER_CATALOGUE.find((one) => one.provider === OPENAPI_PROVIDER)?.kind).toBe(SOURCE_ACCOUNT_KIND)
        for (const template of INSTALLED.providers()) {
            const key = crmProviderKeyOf(template.id)
            expect([key, accountKindOf(key)]).toEqual([key, SOURCE_ACCOUNT_KIND])
        }
        expect(accountKindOf(PROVIDER.nivo)).toBe("nivo")
    })
})

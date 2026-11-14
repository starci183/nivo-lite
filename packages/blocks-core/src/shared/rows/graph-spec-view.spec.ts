import { strict as assert } from "node:assert"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { sampleOf } from "../messages/catalog"
import en from "../messages/en.json"
import vi from "../messages/vi.json"
import { latestTemplateVersion, parseWorkflowTemplate, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import consult from "./legacy-templates/consult.template.json"
import frontDesk from "./legacy-templates/front-desk.template.json"
import reconcile from "./legacy-templates/reconcile.template.json"
import { FOR_EACH_MAX } from "../nodes/core/for-each.node"
import { NODE_KINDS } from "../nodes/node-ui"
import { graphViewOfSpec } from "./graph-spec-view"
import { graphView } from "./graph-view"

/**
 * The last JSON templates of the front desk, the consult and the reconciliation, kept as data for the views of an @1 graph spec (the
 * agents' graphs are `nivo/agent-graph@2` since the flip; the back end reads them into @1 for these views).
 */
const LEGACY_TEMPLATES: ReadonlyArray<WorkflowTemplate> = [frontDesk, consult, reconcile].map((raw) => parseWorkflowTemplate(raw))
const workflowTemplateOf = (id: string): WorkflowTemplate | null => LEGACY_TEMPLATES.find((one) => one.id === id) ?? null

/** The main workflow of each module, as its template ships it now. */
const TEMPLATES: Readonly<Record<string, string>> = {
    chatbot: "chatbot.front-desk",
    sales: "sales.consult",
    accounting: "accounting.reconcile",
}
/** The modules whose main workflow is still installed (the reconcile left with money: its legacy graph stays as data for the views). */
const MODULE_KEYS: ReadonlyArray<string> = ["chatbot", "sales"]

const specOf = (moduleKey: string): GraphSpec => {
    const template = workflowTemplateOf(TEMPLATES[moduleKey] ?? "")
    assert.ok(template !== null, `no template for ${moduleKey}`)
    return latestTemplateVersion(template).graph
}

describe.each(MODULE_KEYS)("graphViewOfSpec of the %s graph", (moduleKey) => {
    const spec = specOf(moduleKey)

    it.each(["vi", "en"] as const)("is a valid graph view whose every node is a card in %s", (locale) => {
        const view = graphViewOfSpec(spec, { locale })

        expect(graphView.safeParse(view).success).toBe(true)
        expect(view.nodes.map((node) => node.id)).toEqual(spec.nodes.map((node) => node.key))
        for (const node of view.nodes) {
            expect(NODE_KINDS).toContain(node.kind)
            expect([node.id, node.icon, node.heroicon, node.title, node.subtitle].every((one) => one !== undefined && one !== "")).toBe(
                true,
            )
            expect(node.label).toBe(node.title)
            expect(node.description).toBe(node.subtitle)
        }
    })

    it("names every route of a branching step as an output with words, and every edge from it by an output", () => {
        const view = graphViewOfSpec(spec, { locale: "vi" })

        for (const node of spec.nodes.filter((one) => one.routes !== undefined)) {
            const outputs = view.nodes.find((one) => one.id === node.key)?.outputs ?? []
            for (const branch of Object.keys(node.routes ?? {})) {
                const output = outputs.find((one) => one.id === branch)
                expect([node.key, branch, output === undefined || output.label === "" || output.label === branch]).toEqual([
                    node.key,
                    branch,
                    false,
                ])
            }
        }
        for (const edge of view.edges.filter((one) => one.fromOutput !== undefined)) {
            const from = view.nodes.find((one) => one.id === edge.from)
            expect((from?.outputs ?? []).map((one) => one.id)).toEqual(expect.arrayContaining([...(edge.fromOutputs ?? [])]))
            expect(edge.label).toBeTruthy()
            expect(edge.condition).toBe(edge.label)
        }
    })

    it("draws no back edge the spec does not write", () => {
        expect(graphViewOfSpec(spec, { locale: "vi" }).edges.some((one) => one.back === true)).toBe(false)
    })
})

describe("graphViewOfSpec", () => {
    it("labels the five routes of understanding the customer, and the ready route of the consult", () => {
        const view = graphViewOfSpec(specOf("chatbot"), { locale: "vi" })
        const edge = (id: string): unknown => view.edges.find((one) => one.id === id)

        expect(edge("understand:buy->to-consult")).toMatchObject({ label: vi.nodeChatbotUnderstandOutputBuy, fromOutput: "buy" })
        expect(edge("understand:question->answer")).toMatchObject({ label: vi.nodeChatbotUnderstandOutputQuestion })
        expect(view.nodes.find((one) => one.id === "understand")?.outputs?.map((one) => one.label)).toEqual([
            vi.nodeChatbotUnderstandOutputBuy,
            vi.nodeChatbotUnderstandOutputBook,
            vi.nodeChatbotUnderstandOutputPaid,
            vi.nodeChatbotUnderstandOutputComplaint,
            vi.nodeChatbotUnderstandOutputQuestion,
        ])
        const consult = graphViewOfSpec(specOf("sales"), { locale: "en" })
        expect(consult.edges.find((one) => one.from === "consult")).toMatchObject({
            to: "create-order",
            fromOutput: "ready",
            label: en.nodeSalesConsultTurnOutputReady,
        })
    })

    it("marks an edge a spec writes back onto its own walk", () => {
        const base = specOf("sales")
        const looped: GraphSpec = {
            ...base,
            nodes: base.nodes.map((node) => (node.key === "notify-order" ? { ...node, next: "consult" } : node)),
        }
        const view = graphViewOfSpec(looped, { locale: "vi" })

        expect(view.edges.find((one) => one.id === "notify-order->consult")).toMatchObject({ back: true })
        expect(view.edges.find((one) => one.id === "send-qr->notify-order")?.back).toBeUndefined()
    })

    it("carries the values and the form of the selected node's settings", () => {
        const view = graphViewOfSpec(specOf("accounting"), { locale: "vi" })
        const call = view.nodes.find((one) => one.id === "to-after-sale")

        expect(call?.params).toMatchObject({ agent: "sales", workflow: "after-sale", version: "latest" })
        expect(call?.paramFields?.map((one) => one.name)).toEqual(expect.arrayContaining(["agent", "workflow", "version"]))
    })

    it("carries the run state of a node and draws the trigger first when asked", () => {
        const view = graphViewOfSpec(specOf("chatbot"), { locale: "vi", states: { understand: "done" }, withTrigger: true })

        expect(view.nodes[0]).toMatchObject({ id: "trigger", kind: "event", icon: "bolt" })
        expect(view.edges[0]).toEqual({ id: "trigger->understand", from: "trigger", to: "understand" })
        expect(view.nodes.find((one) => one.id === "understand")?.state).toBe("done")
        expect(graphView.safeParse(view).success).toBe(true)
    })

    it("gives the kinds the owner asked for: hand-offs and notices are events, ends end, the decision branches", () => {
        const kinds = (moduleKey: string): Readonly<Record<string, string>> =>
            Object.fromEntries(graphViewOfSpec(specOf(moduleKey), { locale: "vi" }).nodes.map((node) => [node.id, node.kind]))

        // The legacy graphs also name steps the flip deleted (chatbot.complaint, sales.create-order): no kind is asserted for them.
        expect(kinds("chatbot")).toMatchObject({
            understand: "condition",
            "to-consult": "event",
            "to-reconcile": "event",
            "to-owner": "end",
            answer: "action",
        })
        // The reconcile's own steps (match, notify-paid) and the consult's order notice left with money: no kind is asserted for them.
        expect(kinds("accounting")).toMatchObject({ "to-after-sale": "event" })
        expect(kinds("sales")).toMatchObject({ consult: "action", won: "end" })
    })
})

describe("graphViewOfSpec contract fields", () => {
    it("fills triggers, outcomes and the entry rule of the view from the spec, in the language asked", () => {
        const chatbotView = graphViewOfSpec(specOf("chatbot"), { locale: "vi" })

        expect(chatbotView.triggers?.map((one) => [one.key, one.sourceKind, one.sourceLabel])).toEqual([
            ["zalo", "zalo", "Zalo"],
            ["telegram", "telegram", "Telegram"],
        ])
        expect(chatbotView.outcomes?.map((one) => [one.key, one.label])).toEqual([["owner", sampleOf("sampleGraphOutcomeOwner")]])
        expect(chatbotView.entry).toEqual({ openTo: "any", label: sampleOf("sampleGraphEntryAny") })
        const accounting = graphViewOfSpec(specOf("accounting"), { locale: "en" })
        expect(accounting.entry).toMatchObject({ openTo: "any" })
        expect(accounting.triggers?.map((one) => [one.key, one.sourceKind])).toEqual([
            ["sepay", "sepay"],
            ["call", "workflow"],
        ])
        // `holdsConversation` is deleted (R35, R43): the sale's entry is open to any caller and holds nothing.
        expect(graphViewOfSpec(specOf("sales"), { locale: "en" }).entry).toMatchObject({ openTo: "any" })
        expect(graphViewOfSpec(specOf("sales"), { locale: "en" }).entry).not.toHaveProperty("holdsConversation")
        expect(graphViewOfSpec(specOf("sales"), { locale: "en" }).triggers?.[0]).toMatchObject({
            key: "call",
            sourceKind: "workflow",
            hasConnection: false,
        })
    })

    it("leaves triggers and outcomes out of the view of a spec from before contracts, and opens the entry to any caller", () => {
        const { triggers: _triggers, outcomes: _outcomes, entry: _entry, ...old } = specOf("chatbot")
        const view = graphViewOfSpec(old, { locale: "vi" })

        expect(view.triggers).toBeUndefined()
        expect(view.outcomes).toBeUndefined()
        expect(view.entry).toMatchObject({ openTo: "any" })
        expect(graphView.safeParse(view).success).toBe(true)
    })

    it("gives every node its bindings: a ref as a chip with its fallback", () => {
        const view = graphViewOfSpec(specOf("chatbot"), { locale: "vi" })
        const understand = view.nodes.find((one) => one.id === "understand")

        expect(understand?.bindings?.find((one) => one.name === "conversationId")).toEqual({
            name: "conversationId",
            label: sampleOf("sampleGraphParamConversation"),
            kind: "ref",
            text: "= trigger.conversationId",
            ref: "trigger.conversationId",
            fallback: null,
        })
        expect(understand?.bindings?.map((one) => [one.name, one.kind, one.ref, one.fallback])).toEqual(
            expect.arrayContaining([
                ["text", "ref", "trigger.text", null],
                ["messages", "ref", "trigger.messages", "[]"],
            ]),
        )
    })

    it("gives a hand-off node its exact target and param table, and an outcome node its outcome and outputs", () => {
        const view = graphViewOfSpec(specOf("accounting"), { locale: "vi" })
        const call = view.nodes.find((one) => one.id === "to-after-sale")

        expect(call?.call).toMatchObject({
            agent: "sales",
            agentLabel: sampleOf("sampleGraphAgentSales"),
            workflow: "after-sale",
            version: "latest",
            versionLabel: sampleOf("sampleGraphVersionLatest"),
            params: [
                { name: "orderId", kind: "ref", ref: "steps.mark-paid.output.orderId" },
                { name: "leadId", kind: "ref", ref: "steps.mark-paid.output.leadId" },
            ],
        })
        expect(call?.outcome).toBeUndefined()
        expect(view.nodes.find((one) => one.id === "match")?.call).toBeUndefined()
        const owner = graphViewOfSpec(specOf("chatbot"), { locale: "vi" }).nodes.find((one) => one.id === "to-owner")
        expect(owner?.outcome).toMatchObject({ key: "owner", label: sampleOf("sampleGraphOutcomeOwner") })
        expect(owner?.call).toBeUndefined()
        expect(
            graphViewOfSpec(specOf("accounting"), { locale: "en" }).nodes.find((one) => one.id === "to-after-sale")?.call,
        ).toMatchObject({ agentLabel: "Sales", versionLabel: "Latest version" })
    })

    describe("loop and parent on a hand-made spec", () => {
        const base = specOf("chatbot")
        const answer = {
            kind: "output",
            step: "chatbot.answer",
            params: { conversationId: { $ref: "trigger.conversationId" }, text: { $ref: "trigger.text" } },
        } as const
        const made: GraphSpec = {
            ...base,
            nodes: [
                {
                    key: "each",
                    kind: "execute",
                    step: "core.for-each",
                    params: { items: { $ref: "trigger.messages" }, max: 5 },
                    routes: { body: "note" },
                    next: "finish",
                },
                { key: "note", ...answer, next: "note-2" },
                { key: "note-2", ...answer },
                {
                    key: "finish",
                    kind: "output",
                    step: "core.outcome",
                    params: { outcome: "owner", outputs: { summary: "ok" } },
                },
            ],
        }
        const view = graphViewOfSpec(made, { locale: "vi" })
        const node = (id: string) => view.nodes.find((one) => one.id === id)

        it("describes the loop: its list, its cap and every node of its body", () => {
            expect(node("each")?.loop).toMatchObject({ items: { name: "items", kind: "ref", ref: "trigger.messages" }, max: 5 })
            expect([...(node("each")?.loop?.bodyKeys ?? [])].sort()).toEqual(["note", "note-2"])
            expect(node("note")?.loop).toBeUndefined()
        })

        it("marks the nodes of the body with the loop that holds them, and no other", () => {
            expect(node("note")?.parent).toBe("each")
            expect(node("note-2")?.parent).toBe("each")
            expect(node("finish")?.parent).toBeUndefined()
            expect(node("each")?.parent).toBeUndefined()
        })

        it("takes the default cap when the loop sets none and no list when its items are unbound", () => {
            const bare: GraphSpec = {
                ...made,
                nodes: made.nodes.map((one) => (one.key === "each" ? { ...one, params: {} } : one)),
            }
            const loop = graphViewOfSpec(bare, { locale: "vi" }).nodes.find((one) => one.id === "each")?.loop

            expect(loop).toMatchObject({ items: null, max: FOR_EACH_MAX })
        })

        it("is a valid graph view", () => {
            expect(graphView.safeParse(view).success).toBe(true)
        })
    })
})

describe("graphViewOfSpec: a hand-off names its target, and its settings are worded (ENG1)", () => {
    const frontDesk = (): GraphSpec => specOf("chatbot")

    it("titles the two front-desk hand-offs by the agent they hand to, so they never read the same", () => {
        const view = graphViewOfSpec(frontDesk(), { locale: "vi" })
        const titles = view.nodes.filter((node) => node.step === "core.call-workflow").map((node) => [node.id, node.title, node.label])
        expect(titles).toEqual([
            ["to-consult", sampleOf("sampleGraphHandOffToSales"), sampleOf("sampleGraphHandOffToSales")],
            ["to-reconcile", sampleOf("sampleGraphHandOffToAccounting"), sampleOf("sampleGraphHandOffToAccounting")],
        ])
        expect(graphViewOfSpec(frontDesk(), { locale: "en" }).nodes.find((node) => node.id === "to-consult")?.title).toBe(
            "Hand off to Sales",
        )
    })

    it("titles a hand-off by its target workflow's name when the reader knows it", () => {
        const names = { "sales.consult": sampleOf("sampleGraphWorkflowConsult"), "accounting.reconcile": sampleOf("sampleGraphWorkflowReconcile") }
        const view = graphViewOfSpec(frontDesk(), { locale: "vi", names })
        expect(view.nodes.find((node) => node.id === "to-consult")?.title).toBe(sampleOf("sampleGraphHandOffToConsult"))
        expect(view.nodes.find((node) => node.id === "to-reconcile")?.title).toBe(sampleOf("sampleGraphHandOffToReconcile"))
        expect(view.nodes.find((node) => node.id === "understand")?.title).toBe(sampleOf("sampleGraphStepUnderstand"))
    })

    it("words every setting of a hand-off in Vietnamese: no bare English parameter name", () => {
        const node = graphViewOfSpec(frontDesk(), { locale: "vi" }).nodes.find((one) => one.id === "to-consult")
        expect(node?.bindings?.map((binding) => [binding.name, binding.label])).toEqual([
            ["agent", sampleOf("sampleGraphSettingAgent")],
            ["workflow", sampleOf("sampleGraphSettingWorkflow")],
            ["version", sampleOf("sampleGraphSettingVersion")],
            ["inputs", sampleOf("sampleGraphSettingInputs")],
        ])
    })
})

// FE-MAP needs (R68): the engine runs a template graph's control steps under its own ids (a condition `core.when`, a wait `core.wait`, an
// `until` loop `core.until`, a hand-back `core.hand-back`). Each is drawn as what it is, in the graph's own words; none is the trigger card,
// and an `until` loop holds its body like a for-each.
describe("graphViewOfSpec: the engine's control steps, named by the graph", () => {
    const words = (vi: string, en: string): { readonly vi: string; readonly en: string } => ({ vi, en })
    const spec: GraphSpec = {
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        trigger: { kind: "tag", sources: ["agent"] },
        grant: { tools: [], effects: [] },
        outcomes: [
            { key: "paid", label: "paid", title: words("Đã trả", "Paid"), outputs: [] },
            { key: "unpaid", label: "unpaid", outputs: [] },
        ],
        nodes: [
            {
                key: "pay",
                kind: "execute",
                step: "core.until",
                params: { mode: "until", max: 6 },
                routes: { body: "await", exhausted: "unpaid" },
                next: "paid",
                label: words("Thanh toán", "Payment"),
                exits: { until: words("Thoát khi đơn đã trả", "Leaves when paid"), exhausted: words("Hết 6 vòng mà chưa trả", "6 rounds unpaid") },
            },
            { key: "await", kind: "execute", step: "core.wait", routes: { credit: "exact", zalo: "give-back", timeout: "remind" }, label: words("Chờ tiền về", "Wait for the money") },
            { key: "exact", kind: "execute", step: "core.when", routes: { yes: "remind" }, label: words("Đủ tiền?", "Exact amount?") },
            { key: "give-back", kind: "execute", step: "core.hand-back", params: { wait: "await" }, label: words("Trả lại tin", "Hand the message back") },
            { key: "remind", kind: "execute", step: "sales.payment-remind" },
            { key: "paid", kind: "execute", step: "core.outcome", params: { outcome: "paid", outputs: {} }, label: words("Đã trả", "Paid") },
            { key: "unpaid", kind: "execute", step: "core.outcome", params: { outcome: "unpaid", outputs: {} } },
            { key: "mystery", kind: "execute", step: "core.not-a-step" },
        ],
    }
    const view = graphViewOfSpec(spec, { locale: "vi" })
    const nodeOf = (key: string) => view.nodes.find((node) => node.id === key)
    const edgeOf = (from: string, to: string) => view.edges.find((edge) => edge.from === from && edge.to === to)

    it("titles each control step by the graph's words, in the reader's language", () => {
        expect(nodeOf("pay")?.title).toBe("Thanh toán")
        expect(nodeOf("await")?.title).toBe("Chờ tiền về")
        expect(nodeOf("exact")?.title).toBe("Đủ tiền?")
        expect(nodeOf("give-back")?.title).toBe("Trả lại tin")
        expect(graphViewOfSpec(spec, { locale: "en" }).nodes.find((node) => node.id === "exact")?.title).toBe("Exact amount?")
    })

    it("draws a condition, a wait, a hand-back and an unknown step as their own kinds: never the trigger card", () => {
        expect(nodeOf("exact")).toMatchObject({ kind: "condition", outputs: [{ id: "yes" }, { id: "no" }] })
        expect(nodeOf("await")?.kind).toBe("wait")
        expect(nodeOf("give-back")?.kind).toBe("event")
        expect(nodeOf("mystery")).toMatchObject({ kind: "action", title: "Bước" })
        const trigger = vi["nodeTriggerTitle" as keyof typeof vi]
        for (const node of view.nodes) expect([node.id, node.title]).not.toEqual([node.id, trigger])
    })

    it("words a wait's roads by what came, and a loop's ways out by the graph's words", () => {
        expect(nodeOf("await")?.outputs?.map((output) => [output.id, output.label])).toEqual([
            ["credit", vi.nodeCoreWaitOutputCredit],
            ["zalo", vi.nodeCoreWaitOutputZalo],
            ["timeout", vi.nodeCoreWaitOutputTimeout],
        ])
        expect(edgeOf("await", "remind")?.label).toBe(vi.nodeCoreWaitOutputTimeout)
        expect(edgeOf("pay", "unpaid")?.label).toBe("Hết 6 vòng mà chưa trả")
        expect(edgeOf("pay", "paid")?.label).toBe("Thoát khi đơn đã trả")
        expect(edgeOf("exact", "remind")?.label).toBe(vi.nodeCoreWhenOutputYes)
    })

    it("holds the until loop's body like a for-each's, with its two ways out", () => {
        expect(nodeOf("pay")?.loop).toEqual({
            items: null,
            max: 6,
            bodyKeys: expect.arrayContaining(["await", "exact", "give-back", "remind"]),
            exits: { until: "Thoát khi đơn đã trả", exhausted: "Hết 6 vòng mà chưa trả" },
        })
        expect(nodeOf("pay")?.loop?.bodyKeys).not.toContain("paid")
        expect(nodeOf("remind")?.parent).toBe("pay")
    })

    it("names an outcome by its words; an outcome with none keeps its key; a loop with no words reads the generic ones", () => {
        expect(nodeOf("paid")?.outcome?.label).toBe("Đã trả")
        expect(nodeOf("unpaid")?.outcome?.label).toBe("unpaid")
        const bare = graphViewOfSpec({ ...spec, nodes: spec.nodes.map((node) => (node.key === "pay" ? { ...node, label: undefined, exits: undefined } : node)) }, { locale: "en" })
        const pay = bare.nodes.find((node) => node.id === "pay")
        expect(pay?.title).toBe(en.nodeCoreUntilTitle)
        expect(pay?.loop?.exits).toEqual({ until: en.nodeCoreUntilOutputDone, exhausted: en.nodeCoreUntilOutputExhausted })
    })

    it("is a valid graph view whose every node is a known kind", () => {
        expect(graphView.safeParse(view).success).toBe(true)
        for (const node of view.nodes) expect(NODE_KINDS).toContain(node.kind)
    })
})

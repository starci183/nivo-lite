import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import en from "../messages/en.json"
import vi from "../messages/vi.json"
import { latestTemplateVersion, workflowTemplateOf } from "../modules/workflow-templates"
import { FOR_EACH_MAX } from "../nodes/core/for-each.node"
import { NODE_KINDS } from "../nodes/node-ui"
import { graphViewOfSpec } from "./graph-spec-view"
import { graphView } from "./graph-view"

/** The main workflow of each module, as its template ships it now. */
const TEMPLATES: Readonly<Record<string, string>> = {
    chatbot: "chatbot.front-desk",
    sales: "sales.consult",
    accounting: "accounting.reconcile",
}
const MODULE_KEYS: ReadonlyArray<string> = Object.keys(TEMPLATES)

const specOf = (moduleKey: string): GraphSpec => {
    const template = workflowTemplateOf(TEMPLATES[moduleKey] ?? "")
    if (template === null) throw new Error(`no template for ${moduleKey}`)
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
    it("labels the four routes of understanding the customer, and the ready route of the consult", () => {
        const view = graphViewOfSpec(specOf("chatbot"), { locale: "vi" })
        const edge = (id: string): unknown => view.edges.find((one) => one.id === id)

        expect(edge("understand:buy->to-consult")).toMatchObject({ label: vi.nodeChatbotUnderstandOutputBuy, fromOutput: "buy" })
        expect(edge("understand:question->answer")).toMatchObject({ label: vi.nodeChatbotUnderstandOutputQuestion })
        expect(view.nodes.find((one) => one.id === "understand")?.outputs?.map((one) => one.label)).toEqual([
            vi.nodeChatbotUnderstandOutputBuy,
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

        expect(kinds("chatbot")).toEqual({
            understand: "condition",
            "to-consult": "event",
            "to-reconcile": "event",
            complaint: "action",
            "to-owner": "end",
            answer: "action",
        })
        expect(kinds("accounting")).toMatchObject({ match: "action", "notify-paid": "event", "to-after-sale": "event" })
        expect(kinds("sales")).toMatchObject({ consult: "action", "create-order": "action", "notify-order": "event", won: "end" })
    })
})

describe("graphViewOfSpec contract fields", () => {
    it("fills triggers, outcomes and the entry rule of the view from the spec, in the language asked", () => {
        const chatbotView = graphViewOfSpec(specOf("chatbot"), { locale: "vi" })

        expect(chatbotView.triggers?.map((one) => [one.key, one.sourceKind, one.sourceLabel])).toEqual([
            ["zalo", "zalo", "Zalo"],
            ["telegram", "telegram", "Telegram"],
        ])
        expect(chatbotView.outcomes?.map((one) => [one.key, one.label])).toEqual([["owner", "Chuyển chủ tiệm"]])
        expect(chatbotView.entry).toEqual({ openTo: "any", holdsConversation: false, label: "Mọi quy trình được gọi" })
        const accounting = graphViewOfSpec(specOf("accounting"), { locale: "en" })
        expect(accounting.entry).toMatchObject({ openTo: "any", holdsConversation: false })
        expect(accounting.triggers?.map((one) => [one.key, one.sourceKind])).toEqual([
            ["sepay", "sepay"],
            ["call", "workflow"],
        ])
        expect(graphViewOfSpec(specOf("sales"), { locale: "en" }).entry).toMatchObject({ openTo: "any", holdsConversation: true })
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
            label: "Cuộc trò chuyện",
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
            agentLabel: "Bán hàng",
            workflow: "after-sale",
            version: "latest",
            versionLabel: "Bản mới nhất",
            params: [
                { name: "orderId", kind: "ref", ref: "steps.mark-paid.output.orderId" },
                { name: "leadId", kind: "ref", ref: "steps.mark-paid.output.leadId" },
            ],
        })
        expect(call?.outcome).toBeUndefined()
        expect(view.nodes.find((one) => one.id === "match")?.call).toBeUndefined()
        const owner = graphViewOfSpec(specOf("chatbot"), { locale: "vi" }).nodes.find((one) => one.id === "to-owner")
        expect(owner?.outcome).toMatchObject({ key: "owner", label: "Chuyển chủ tiệm" })
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

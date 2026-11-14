import { aiCallLabelOf } from "./ai-call-label"
import { callEdgesOf, contractViewsOf, type ContractWords } from "./contract-view"
import type { GraphSpec } from "../graph-spec.types"

const words: ContractWords = {
    sourceLabel: (kind) => `source:${kind}`,
    entryLabel: (openTo) => `entry:${openTo}`,
    typeLabel: (type) => `type:${type}`,
    conditionWord: (op) => op,
    paramLabel: (name) => (name === "orderId" ? "Order" : undefined),
    pathSeparator: () => " > ",
    versionLatest: () => "latest",
    versionPinned: () => "pinned {version}",
    problem: (code) => `${code} at {where} {name}`,
    agentLabel: (agent) => (agent === "sales" ? "Sales" : undefined),
}

const views = contractViewsOf(words)

const spec = {
    nodes: [
        { key: "end", step: "core.outcome", params: { outcome: "done" }, next: "hand" },
        { key: "hand", step: "core.call-workflow", params: { agent: "sales", workflow: "pay", version: 2, inputs: { orderId: { $ref: "steps.a.output.id" } } } },
    ],
} as unknown as GraphSpec

describe("contract views over injected words", () => {
    it("words a param from the source, a dotted path member by member, and falls back on the name", () => {
        expect(views.paramLabelOf("orderId", "vi")).toBe("Order")
        expect(views.paramLabelOf("orderId.other", "en")).toBe("Order > other")
        expect(views.paramLabelOf("zzz", "vi")).toBe("zzz")
    })

    it("draws a ref as a chip and a fixed value as plain text", () => {
        expect(views.bindingViewsOf({ orderId: { $ref: "x.y", default: 1 }, note: "hi" })).toEqual([
            { name: "orderId", label: "Order", kind: "ref", text: "= x.y", ref: "x.y", fallback: "1" },
            { name: "note", label: "note", kind: "fixed", text: "hi", ref: null, fallback: null },
        ])
    })

    it("names the agent a hand-off calls from the source and the pinned version", () => {
        const node = spec.nodes[1]
        if (node === undefined) throw new Error("fixture")
        expect(views.callViewOf(node, "en")).toMatchObject({ agentLabel: "Sales", versionLabel: "pinned 2" })
    })

    it("reads the outcome a hand-off follows without any words", () => {
        expect(callEdgesOf(spec)).toEqual([{ nodeKey: "hand", outcome: "done", agent: "sales", workflow: "pay", version: "2" }])
    })
})

describe("aiCallLabelOf", () => {
    it("names a node call by its step title, else by the call kind, else nothing", () => {
        const book: Record<string, string> = { nodeChatbotAnswerTitle: "Answer", aiCallEngineStepTrouble: "Trouble" }
        const lookup = (key: string): string | null => book[key] ?? null
        expect(aiCallLabelOf("chatbot.answer:answer", lookup)).toBe("Answer")
        expect(aiCallLabelOf("engine:step-trouble", lookup)).toBe("Trouble")
        expect(aiCallLabelOf("unknown:kind", lookup)).toBeNull()
    })
})

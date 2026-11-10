import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { bindableFieldsOf, outputFieldsOf, pickTypeFits, refChipTextOf, refOptionsOf } from "./ref-options"

const SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    contract: {
        inputs: [
            { name: "conversationId", type: "string", required: true },
            { name: "leadId", type: "string", required: true },
        ],
    },
    outcomes: [{ key: "won", label: "Chốt mua", outputs: [{ name: "orderId", type: "string" }] }],
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        { key: "record", kind: "output", step: "sales.create-order", next: "won" },
        { key: "won", kind: "output", step: "core.outcome", params: { outcome: "won", outputs: {} }, next: "call" },
        { key: "call", kind: "output", step: "core.call-workflow", next: "tell" },
        { key: "tell", kind: "output", step: "chatbot.answer" },
    ],
}

describe("the output picker", () => {
    it("offers the inputs, the outputs of the steps before, the outcome before and the lead's facts", () => {
        const refs = refOptionsOf(SPEC, "call", "vi").map((option) => option.ref)
        expect(refs).toEqual(expect.arrayContaining(["trigger.conversationId", "out.orderId", "steps.record.output.orderId", "lead.address"]))
        expect(refs).not.toContain("steps.call.output.agent")
    })

    it("offers no failure of a step: a step has no failure route", () => {
        expect(refOptionsOf(SPEC, "tell", "vi").some((option) => option.ref.includes(".error."))).toBe(false)
    })

    it("keeps only what fits a typed param, and words each value", () => {
        const options = refOptionsOf(SPEC, "call", "vi", "array")
        expect(options.every((option) => ["array", "unknown", "null"].includes(option.type))).toBe(true)
        const [first] = refOptionsOf(SPEC, "call", "vi")
        expect(first).toMatchObject({ ref: "trigger.conversationId", text: "= trigger.conversationId", group: "Đầu vào", label: "Cuộc trò chuyện" })
        expect(pickTypeFits("number", "integer")).toBe(true)
        expect(pickTypeFits("string", "number")).toBe(false)
    })

    it("lists the data params a step takes and what it answers, typed", () => {
        expect(bindableFieldsOf("chatbot.answer", "vi").map((field) => field.name)).toContain("conversationId")
        expect(bindableFieldsOf("not.installed", "vi")).toEqual([])
        expect(outputFieldsOf("sales.create-order", "en").map((field) => field.name)).toContain("orderId")
    })

    it("words a ref chip by its member and where it comes from, never by its path", () => {
        expect(refChipTextOf(SPEC, "call", "trigger.leadId", "vi")).toBe("= Khách · Đầu vào")
        expect(refChipTextOf(SPEC, "call", "steps.record.output.orderId", "vi")).toBe("= Đơn hàng · Tạo đơn")
        expect(refChipTextOf(SPEC, "call", "out.orderId", "vi")).toBe("= Đơn hàng · Kết quả: Chốt mua")
        expect(refChipTextOf(SPEC, "call", "lead.address", "en")).toBe("= Address · Customer")
        expect(refChipTextOf(SPEC, "tell", "steps.ghost.output.orderId", "vi")).toBe("= Đơn hàng · ghost")
    })
})

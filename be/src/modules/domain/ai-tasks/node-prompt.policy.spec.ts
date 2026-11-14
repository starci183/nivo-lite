import { Test } from "@nestjs/testing"
import { STOCK_QUESTION_VI } from "@tests/fixtures/i18n/ai-tasks-spec.messages"
import { nodeMessagesOf, nodeMetaOf, nodePromptOf } from "./node-prompt.policy"
import { ITEMS_SCHEMA } from "@tests/fixtures/builders/ai-tasks-service.builder"

const ASK = { purpose: "intent.classify:read", instructions: "Rules", input: { text: "hi" } }

const SUBJECT = Symbol("node-prompt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nodeMessagesOf, nodeMetaOf, nodePromptOf } }],
    }).compile()
    return moduleRef.get<typeof import("./node-prompt.policy")>(SUBJECT)
}

describe("node-prompt policy", () => {
    let policy: typeof import("./node-prompt.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("sends the instructions as the system message and the input as JSON in the user message", () => {
        expect(policy.nodeMessagesOf(ASK)).toEqual([
            { role: "system", content: "Rules", cacheMark: true },
            { role: "user", content: '{"text":"hi"}' },
        ])
        expect(policy.nodeMessagesOf({ ...ASK, input: undefined })[1]).toEqual({ role: "user", content: "null" })
    })

    it("names the answer's members and their types in the system message of a structured call", () => {
        const [system] = policy.nodeMessagesOf(ASK, ITEMS_SCHEMA)

        expect(system?.content.startsWith("Rules\n\nAnswer with one JSON object")).toBe(true)
        expect(system?.content).toContain('"items":')
        expect(system?.content).toContain('"amount_vnd":')
        expect(system?.content).toContain('"type":["number","null"]')
    })

    it("keeps the instructions alone for a free-text call", () => {
        expect(policy.nodeMessagesOf(ASK)[0]).toEqual({ role: "system", content: "Rules", cacheMark: true })
    })

    it("attaches the pictures of the call to the user message, and leaves the key out when there are none", () => {
        const withImages = policy.nodeMessagesOf({ ...ASK, images: ["https://files/a.jpg"] })
        expect(withImages[1]).toEqual({ role: "user", content: '{"text":"hi"}', images: ["https://files/a.jpg"] })
        expect(policy.nodeMessagesOf({ ...ASK, images: [] })[1]).not.toHaveProperty("images")
    })

    it("prompt cache: opens two calls of a step with the same system message whatever their words and data for this call", () => {
        const first = policy.nodePromptOf({ ...ASK, input: { thread: ["hi"], at: "2026-11-10T01:00:00Z" } }, ITEMS_SCHEMA)
        const second = policy.nodePromptOf(
            { ...ASK, volatile: "The founder answered.", input: { thread: ["hi", STOCK_QUESTION_VI], leadId: "lead-9" } },
            ITEMS_SCHEMA,
        )

        expect(second.stable).toEqual(first.stable)
        expect(JSON.stringify(second.stable)).toBe(JSON.stringify(first.stable))
        expect(first.stable).toHaveLength(1)
        expect(first.volatile).toEqual([{ role: "user", content: '{"thread":["hi"],"at":"2026-11-10T01:00:00Z"}' }])
        expect(second.volatile).toEqual([
            { role: "system", content: "The founder answered." },
            { role: "user", content: JSON.stringify({ thread: ["hi", STOCK_QUESTION_VI], leadId: "lead-9" }) },
        ])
        // What is sent is the stable part, then the volatile one.
        expect(policy.nodeMessagesOf({ ...ASK, volatile: "V" })).toEqual([
            { role: "system", content: "Rules", cacheMark: true },
            { role: "system", content: "V" },
            { role: "user", content: '{"text":"hi"}' },
        ])
    })

    it("meters the call as engine work of the namespace of the node", () => {
        expect(policy.nodeMetaOf(ASK)).toEqual({ kind: "engine", module: "intent" })
    })
})

describe("node-prompt policy: the shared opening of a node's call (ENG1)", () => {
    const LAYERED = { ...ASK, instructions: "CRAFT TOOLS\n\nSHOP\n\nSTEP", sharedLength: "CRAFT TOOLS\n\nSHOP".length }

    it("sends L1 + L2 and L3 as two marked system messages, the text cut at the blank line and nothing else changed", () => {
        expect(nodePromptOf(LAYERED).stable).toEqual([
            { role: "system", content: "CRAFT TOOLS\n\nSHOP", cacheMark: true },
            { role: "system", content: "STEP", cacheMark: true },
        ])
        expect(nodePromptOf(LAYERED, ITEMS_SCHEMA).stable[1]?.content.startsWith("STEP\n\nAnswer with one JSON object")).toBe(true)
    })

    it("keeps one marked message when the length names no layer end of the instructions", () => {
        for (const sharedLength of [undefined, 0, 3, 2.5, 999]) {
            expect(nodePromptOf({ ...LAYERED, sharedLength }).stable).toEqual([
                { role: "system", content: LAYERED.instructions, cacheMark: true },
            ])
        }
    })
})

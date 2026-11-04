import { Test } from "@nestjs/testing"
import { nodeMessagesOf, nodeMetaOf } from "./node-prompt.policy"
import { ORDER_SCHEMA } from "./ai-tasks.schema"

const ASK = { purpose: "intent.classify:read", instructions: "Rules", input: { text: "hi" } }

const SUBJECT = Symbol("node-prompt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nodeMessagesOf, nodeMetaOf } }],
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
            { role: "system", content: "Rules" },
            { role: "user", content: '{"text":"hi"}' },
        ])
        expect(policy.nodeMessagesOf({ ...ASK, input: undefined })[1]).toEqual({ role: "user", content: "null" })
    })

    it("names the answer's members and their types in the system message of a structured call", () => {
        const [system] = policy.nodeMessagesOf(ASK, ORDER_SCHEMA)

        expect(system?.content.startsWith("Rules\n\nAnswer with one JSON object")).toBe(true)
        expect(system?.content).toContain('"items":')
        expect(system?.content).toContain('"amount_vnd":')
        expect(system?.content).toContain('"type":["number","null"]')
    })

    it("keeps the instructions alone for a free-text call", () => {
        expect(policy.nodeMessagesOf(ASK)[0]).toEqual({ role: "system", content: "Rules" })
    })

    it("attaches the pictures of the call to the user message, and leaves the key out when there are none", () => {
        const withImages = policy.nodeMessagesOf({ ...ASK, images: ["https://files/a.jpg"] })
        expect(withImages[1]).toEqual({ role: "user", content: '{"text":"hi"}', images: ["https://files/a.jpg"] })
        expect(policy.nodeMessagesOf({ ...ASK, images: [] })[1]).not.toHaveProperty("images")
    })

    it("meters the call as engine work of the namespace of the node", () => {
        expect(policy.nodeMetaOf(ASK)).toEqual({ kind: "engine", module: "intent" })
    })
})

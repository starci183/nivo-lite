import { ORDER_SCHEMA } from "./ai-tasks.schema"
import { nodeMessagesOf, nodeMetaOf } from "./node-prompt.policy"

const ASK = { purpose: "intent.classify:read", instructions: "Rules", input: { text: "hi" } }

describe("node-prompt policy", () => {
    it("sends the instructions as the system message and the input as JSON in the user message", () => {
        expect(nodeMessagesOf(ASK)).toEqual([
            { role: "system", content: "Rules" },
            { role: "user", content: '{"text":"hi"}' },
        ])
        expect(nodeMessagesOf({ ...ASK, input: undefined })[1]).toEqual({ role: "user", content: "null" })
    })

    it("names the answer's members and their types in the system message of a structured call", () => {
        const [system] = nodeMessagesOf(ASK, ORDER_SCHEMA)

        expect(system?.content.startsWith("Rules\n\nAnswer with one JSON object")).toBe(true)
        expect(system?.content).toContain('"items":')
        expect(system?.content).toContain('"amount_vnd":')
        expect(system?.content).toContain('"type":["number","null"]')
    })

    it("keeps the instructions alone for a free-text call", () => {
        expect(nodeMessagesOf(ASK)[0]).toEqual({ role: "system", content: "Rules" })
    })

    it("attaches the pictures of the call to the user message, and leaves the key out when there are none", () => {
        const withImages = nodeMessagesOf({ ...ASK, images: ["https://files/a.jpg"] })
        expect(withImages[1]).toEqual({ role: "user", content: '{"text":"hi"}', images: ["https://files/a.jpg"] })
        expect(nodeMessagesOf({ ...ASK, images: [] })[1]).not.toHaveProperty("images")
    })

    it("meters the call as engine work of the namespace of the node", () => {
        expect(nodeMetaOf(ASK)).toEqual({ kind: "engine", module: "intent" })
    })
})

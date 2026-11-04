import { z } from "zod"
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

    it("names the answer's members, types and allowed values in the system message of a structured call", () => {
        const schema = z.object({ intents: z.array(z.enum(["order", "question"])), address: z.string().nullable() })
        const [system] = nodeMessagesOf(ASK, schema)
        const named = JSON.parse(system?.content.split("\n").at(-1) ?? "{}") as { properties?: Record<string, unknown> }

        expect(system?.content.startsWith("Rules\n\nAnswer with one JSON object")).toBe(true)
        expect(Object.keys(named.properties ?? {})).toEqual(["intents", "address"])
        expect(JSON.stringify(named.properties?.intents)).toContain('"enum":["order","question"]')
    })

    it("still describes an answer whose schema transforms what it parses", () => {
        const [system] = nodeMessagesOf(ASK, z.object({ at: z.string().transform((value) => new Date(value)) }))

        expect(system?.content).toContain('"at"')
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

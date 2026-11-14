import { callOpSchema, describeOpOutputSchema, searchOpsOutputSchema } from "./mcp-surface.schema"

const entry = { name: "nivo.api.nivo.contact.merge", summary: "s".repeat(700), kind: "data", readOnly: false, destructive: true, directTool: "nivo_contact_merge" }

describe("the outbound surface answers", () => {
    it("take a full page of 25 entries with the longest summary a declaration has and a cursor of 20 characters", () => {
        const schema = searchOpsOutputSchema
        expect(schema.safeParse({ ops: Array.from({ length: 25 }, () => entry), next: "c".repeat(20) }).success).toBe(true)
    })

    it("refuse a page of 26, a cursor of 21 and a name past the longest op name", () => {
        const schema = searchOpsOutputSchema
        expect(schema.safeParse({ ops: Array.from({ length: 26 }, () => entry), next: null }).success).toBe(false)
        expect(schema.safeParse({ ops: [], next: "c".repeat(21) }).success).toBe(false)
        expect(schema.safeParse({ ops: [{ ...entry, name: "n".repeat(114) }], next: null }).success).toBe(false)
    })

    it("describe an op at the largest name and summary, and refuse a summary past 4000", () => {
        const schema = describeOpOutputSchema
        const described = {
            name: "n".repeat(113),
            summary: "s".repeat(4000),
            kind: "data",
            readOnly: true,
            destructive: false,
            idempotent: true,
            role: "manager",
            inputSchema: {},
            outputSchema: {},
            graphqlOperation: "contacts",
            directTool: null,
        }
        expect(schema.safeParse(described).success).toBe(true)
        expect(schema.safeParse({ ...described, summary: "s".repeat(4001) }).success).toBe(false)
    })
})

describe("the arguments of nivo_call", () => {
    it("take JSON arguments of any depth and refuse an object with more than 1000 entries", () => {
        const schema = callOpSchema
        const name = "nivo.api.nivo.workbench.read"
        const many = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`k${String(index)}`, index]))
        expect(schema.safeParse({ name, args: { vars: { deep: [[{ a: [1, "x", null] }]] } } }).success).toBe(true)
        expect(schema.safeParse({ name, args: many }).success).toBe(false)
    })
})

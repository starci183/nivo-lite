import { BRAIN_FACTS_GET_SCHEMA, BRAIN_FACTS_LIST_SCHEMA, BRAIN_SEARCH_SCHEMA } from "./brain-native.schema"

describe("BRAIN_SEARCH_SCHEMA", () => {
    it("takes a question and supplies the default limit", () => {
        expect(BRAIN_SEARCH_SCHEMA.parse({ query: "hours" })).toEqual({ query: "hours", limit: 6 })
        expect(BRAIN_SEARCH_SCHEMA.parse({ query: "hours", limit: 8 })).toEqual({ query: "hours", limit: 8 })
    })

    it.each([
        ["no question", {}],
        ["an empty question", { query: "" }],
        ["a question above 500 characters", { query: "x".repeat(501) }],
        ["a limit above eight", { query: "a", limit: 9 }],
        ["a limit below one", { query: "a", limit: 0 }],
        ["a fractional limit", { query: "a", limit: 1.5 }],
        ["a workspace", { query: "a", workspaceId: "w" }],
        ["a module", { query: "a", module: "sales" }],
    ])("rejects %s", (_label, args) => {
        expect(BRAIN_SEARCH_SCHEMA.safeParse(args).success).toBe(false)
    })
})

describe("BRAIN_FACTS_LIST_SCHEMA", () => {
    it("takes nothing, a subject and a limit, and supplies the default limit", () => {
        expect(BRAIN_FACTS_LIST_SCHEMA.parse({})).toEqual({ limit: 20 })
        expect(BRAIN_FACTS_LIST_SCHEMA.parse({ subject: "Shop", limit: 50 })).toEqual({ subject: "Shop", limit: 50 })
    })

    it.each([
        ["an empty subject", { subject: "" }],
        ["a subject above 160 characters", { subject: "x".repeat(161) }],
        ["a limit above fifty", { limit: 51 }],
        ["an agent", { agentId: "a1" }],
    ])("rejects %s", (_label, args) => {
        expect(BRAIN_FACTS_LIST_SCHEMA.safeParse(args).success).toBe(false)
    })
})

describe("BRAIN_FACTS_GET_SCHEMA", () => {
    it("takes the id of a fact", () => {
        const id = "11111111-1111-4111-8111-111111111111"
        expect(BRAIN_FACTS_GET_SCHEMA.parse({ id })).toEqual({ id })
    })

    it.each([
        ["no id", {}],
        ["an id that is no uuid", { id: "f1" }],
        ["an undeclared member", { id: "11111111-1111-4111-8111-111111111111", scope: "internal" }],
    ])("rejects %s", (_label, args) => {
        expect(BRAIN_FACTS_GET_SCHEMA.safeParse(args).success).toBe(false)
    })
})

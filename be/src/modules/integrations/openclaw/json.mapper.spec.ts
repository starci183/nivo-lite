import { agentListOf, agentsOf, hasDefaultAgent, isAgentEntry, isJsonObject } from "./json.mapper"

describe("json mapper", () => {
    it("tells an object from everything else", () => {
        expect(isJsonObject({ a: 1 })).toBe(true)
        expect(isJsonObject([])).toBe(false)
        expect(isJsonObject(null)).toBe(false)
        expect(isJsonObject("text")).toBe(false)
    })

    it("recognises an agent entry by its string id", () => {
        expect(isAgentEntry({ id: "a" })).toBe(true)
        expect(isAgentEntry({ id: 1 })).toBe(false)
        expect(isAgentEntry("a")).toBe(false)
    })

    it("reads the agents object and list, empty when there are none", () => {
        expect(agentsOf({ agents: { list: [1] } })).toEqual({ list: [1] })
        expect(agentsOf({ agents: [] })).toEqual({})
        expect(agentListOf({ agents: { list: [{ id: "a" }] } })).toEqual([{ id: "a" }])
        expect(agentListOf({ agents: { list: "x" } })).toEqual([])
        expect(agentListOf({})).toEqual([])
    })

    it("finds a default agent or the implicit main one", () => {
        expect(hasDefaultAgent([{ id: "x", default: true }])).toBe(true)
        expect(hasDefaultAgent([{ id: "main" }])).toBe(true)
        expect(hasDefaultAgent([{ id: "x" }, "text"])).toBe(false)
        expect(hasDefaultAgent([])).toBe(false)
    })
})

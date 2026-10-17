import { Test } from "@nestjs/testing"
import { isJsonObject, isAgentEntry, agentListOf, agentsOf, hasDefaultAgent } from "./json.mapper"

const SUBJECT = Symbol("json.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { isJsonObject, isAgentEntry, agentListOf, agentsOf, hasDefaultAgent } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./json.mapper")>(SUBJECT)
}

describe("json mapper", () => {
    it("tells an object from everything else", async () => {
        const subject = await build()

        expect(subject.isJsonObject({ a: 1 })).toBe(true)
        expect(subject.isJsonObject([])).toBe(false)
        expect(subject.isJsonObject(null)).toBe(false)
        expect(subject.isJsonObject("text")).toBe(false)
    })

    it("recognises an agent entry by its string id", async () => {
        const subject = await build()

        expect(subject.isAgentEntry({ id: "a" })).toBe(true)
        expect(subject.isAgentEntry({ id: 1 })).toBe(false)
        expect(subject.isAgentEntry("a")).toBe(false)
    })

    it("reads the agents object and list, empty when there are none", async () => {
        const subject = await build()

        expect(subject.agentsOf({ agents: { list: [1] } })).toEqual({ list: [1] })
        expect(subject.agentsOf({ agents: [] })).toEqual({})
        expect(subject.agentListOf({ agents: { list: [{ id: "a" }] } })).toEqual([{ id: "a" }])
        expect(subject.agentListOf({ agents: { list: "x" } })).toEqual([])
        expect(subject.agentListOf({})).toEqual([])
    })

    it("finds a default agent or the implicit main one", async () => {
        const subject = await build()

        expect(subject.hasDefaultAgent([{ id: "x", default: true }])).toBe(true)
        expect(subject.hasDefaultAgent([{ id: "main" }])).toBe(true)
        expect(subject.hasDefaultAgent([{ id: "x" }, "text"])).toBe(false)
        expect(subject.hasDefaultAgent([])).toBe(false)
    })
})

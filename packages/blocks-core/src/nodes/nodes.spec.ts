import { coreNodes } from "./core-nodes"

// The worked examples of every node run in the root conformance spec; these cover what an example cannot say.

describe("coreNodes", () => {
    it("keeps the conditions pure: they route on a branch and declare no effect", () => {
        const conditions = coreNodes.filter((node) => node.role === "condition")

        expect(conditions.map((node) => node.id)).toEqual(expect.arrayContaining(["chatbot.understand", "core.if"]))
        expect(conditions.every((node) => node.effects.length === 0)).toBe(true)
    })
})

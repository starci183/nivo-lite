import { authorKindOf, deliveryWordOf, markOf, PREVIEW_MAX, previewOf, roleOf, sideOf } from "./message"

describe("roleOf", () => {
    it("keeps the agent and system roles and reads anything else as the customer", () => {
        expect(["agent", "system", "user", "bot", ""].map(roleOf)).toEqual(["agent", "system", "user", "user", "user"])
    })
})

describe("sideOf", () => {
    it("puts the customer on the incoming side, the agent outgoing and the system as a notice", () => {
        expect(["user", "agent", "system"].map((role) => sideOf(roleOf(role)))).toEqual([
            "incoming",
            "outgoing",
            "notice",
        ])
    })
})

describe("authorKindOf", () => {
    it("tells a person from the AI, and takes a missing kind for the AI", () => {
        expect([authorKindOf("human"), authorKindOf("ai"), authorKindOf(null)]).toEqual(["human", "ai", "ai"])
    })
})

describe("deliveryWordOf", () => {
    it("draws no delivery for a line of the customer or the system", () => {
        expect(deliveryWordOf("user", "ai", "sent")).toBe("")
        expect(deliveryWordOf("system", "human", null)).toBe("")
    })

    it("names a pushed line sent or failed", () => {
        expect(deliveryWordOf("agent", "ai", "sent")).toBe("sent")
        expect(deliveryWordOf("agent", "human", "failed")).toBe("failed")
    })

    it("queues a person's line that is not pushed yet and leaves an AI line unmarked", () => {
        expect(deliveryWordOf("agent", "human", null)).toBe("queued")
        expect(deliveryWordOf("agent", "ai", null)).toBe("")
        expect(deliveryWordOf("agent", "ai", "other")).toBe("")
    })
})

describe("markOf", () => {
    it("marks only the lines the AI wrote", () => {
        expect(markOf("agent", "ai")).toBe("AI")
        expect(markOf("agent", "human")).toBe("")
        expect(markOf("user", "ai")).toBe("")
    })
})

describe("previewOf", () => {
    it("keeps a short text as it is, up to the limit", () => {
        expect(previewOf("Hello")).toBe("Hello")
        expect(previewOf("a".repeat(PREVIEW_MAX))).toBe("a".repeat(PREVIEW_MAX))
    })

    it("cuts a longer text and ends it with an ellipsis, without a space before it", () => {
        const preview = previewOf(`${"a".repeat(PREVIEW_MAX - 2)} bbbbb`)
        expect(preview).toBe(`${"a".repeat(PREVIEW_MAX - 2)}...`)
        expect(previewOf("b".repeat(PREVIEW_MAX + 1))).toBe(`${"b".repeat(PREVIEW_MAX - 1)}...`)
    })
})

import { iterationKeyOf, iterationKeyPartsOf } from "./memory.contracts"

describe("the key of a for-each body step: <loop>[<item>].<node>", () => {
    it("names the loop, the item's identity and the body node", () => {
        expect(iterationKeyOf("each", "o-1", "send")).toBe("each[o-1].send")
        expect(iterationKeyOf("each", "0", "record")).toBe("each[0].record")
    })

    it("reads the three parts back, whatever the identity holds (a node key never holds `]` or `.`)", () => {
        expect(iterationKeyPartsOf("each[o-1].send")).toEqual({ loopKey: "each", itemKey: "o-1", nodeKey: "send" })
        expect(iterationKeyPartsOf("each[INV.7].record")).toEqual({ loopKey: "each", itemKey: "INV.7", nodeKey: "record" })
        expect(iterationKeyPartsOf("each[a].b].record")).toEqual({ loopKey: "each", itemKey: "a].b", nodeKey: "record" })
        expect(iterationKeyPartsOf(iterationKeyOf("round", "sha-0123", "note"))).toEqual({
            loopKey: "round",
            itemKey: "sha-0123",
            nodeKey: "note",
        })
    })

    it("answers null for the key of a step outside every loop", () => {
        expect(iterationKeyPartsOf("send")).toBeNull()
        expect(iterationKeyPartsOf("send[2]")).toBeNull()
        expect(iterationKeyPartsOf("[x].send")).toBeNull()
        expect(iterationKeyPartsOf("each[x].")).toBeNull()
    })
})

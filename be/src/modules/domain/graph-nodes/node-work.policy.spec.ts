import { nodeWorkOf } from "./node-work.policy"

describe("nodeWorkOf", () => {
    it("books a node's calls to the step of the run step key and to the turn's agent", () => {
        expect(nodeWorkOf("3355daf0-0000-4000-8000-000000000001:match", "agent-1")).toEqual({
            kind: "node",
            stepKey: "match",
            agentId: "agent-1",
        })
    })

    it("keeps a step key that holds a colon whole, and takes a key with no run part as the step", () => {
        expect(nodeWorkOf("run-1:approve:send-qr", "a").stepKey).toBe("approve:send-qr")
        expect(nodeWorkOf("match", "a").stepKey).toBe("match")
        expect(nodeWorkOf("run-1:", "a").stepKey).toBeNull()
    })
})

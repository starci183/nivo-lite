import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { agentToLookUp, resolveOwner } from "./responsibility-owner.policy"

describe("responsibility owner policy", () => {
    describe("agentToLookUp", () => {
        it("looks nothing up for the signed-in person", () => {
            expect(agentToLookUp("human")).toBeNull()
        })

        it("looks up the agent a chosen owner names", () => {
            expect(agentToLookUp("agent-1")).toBe("agent-1")
        })
    })

    describe("resolveOwner", () => {
        it("makes the signed-in person the owner under their own name", () => {
            expect(resolveOwner("human", undefined, "Linh")).toEqual({
                kind: "ok",
                value: { kind: "human", agentId: null, name: "Linh" },
            })
        })

        it("makes an agent of the workspace the owner under the agent's name", () => {
            expect(resolveOwner("agent-1", { id: "agent-1", name: "Sales AI" }, "Linh")).toEqual({
                kind: "ok",
                value: { kind: "agent", agentId: "agent-1", name: "Sales AI" },
            })
        })

        it("refuses an owner that is not an agent of the workspace", () => {
            expect(resolveOwner("agent-9", undefined, "Linh")).toEqual({
                kind: "refused",
                code: ResponsibilitiesErrorCode.AgentNotFound,
                params: { id: "agent-9" },
            })
        })
    })
})

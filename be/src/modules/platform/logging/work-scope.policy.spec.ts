import { withWorkScope, workInScope } from "./work-scope.policy"

describe("work scope", () => {
    it("is null outside any work, and holds the work for everything it awaits", async () => {
        expect(workInScope()).toBeNull()

        const seen = await withWorkScope({ kind: "document_read", ref: "source:s1" }, async () => {
            await Promise.resolve()
            return workInScope()
        })

        expect(seen).toEqual({ kind: "document_read", ref: "source:s1", stepKey: null, agentId: null })
        expect(workInScope()).toBeNull()
    })

    it("an inner scope names its own kind and keeps what the outer one named that it does not (a node inside a chat turn)", async () => {
        const seen = await withWorkScope({ kind: "chat_turn", ref: "message:r1/m1", agentId: "a1" }, () =>
            withWorkScope({ kind: "node", stepKey: "reply" }, () => Promise.resolve(workInScope())),
        )

        expect(seen).toEqual({ kind: "node", ref: "message:r1/m1", stepKey: "reply", agentId: "a1" })
    })
})

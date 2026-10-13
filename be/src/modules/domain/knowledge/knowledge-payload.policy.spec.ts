import { reembedPayloadOf, sourcePayloadOf } from "./knowledge-payload.policy"

describe("sourcePayloadOf", () => {
    it("gives back a payload with a source and a workspace", () => {
        const payload = { sourceId: "s1", workspaceId: "w1" }

        expect(sourcePayloadOf(payload)).toBe(payload)
    })

    it("gives nothing for any other payload", () => {
        expect(sourcePayloadOf({ sourceId: "s1" })).toBeNull()
    })
})

describe("reembedPayloadOf", () => {
    it("gives back a payload with a workspace and an optional model", () => {
        expect(reembedPayloadOf({ workspaceId: "w1" })).toEqual({ workspaceId: "w1" })
        expect(reembedPayloadOf({ workspaceId: "w1", model: "m" })).toEqual({ workspaceId: "w1", model: "m" })
    })

    it("gives nothing for any other payload", () => {
        expect(reembedPayloadOf({ model: "m" })).toBeNull()
    })
})

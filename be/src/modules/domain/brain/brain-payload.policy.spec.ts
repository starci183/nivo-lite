import { sourcePayloadOf } from "./brain-payload.policy"

describe("sourcePayloadOf", () => {
    it("returns the source and workspace identifiers of a source job", () => {
        const payload = { sourceId: "s1", workspaceId: "ws1" }
        expect(sourcePayloadOf(payload)).toBe(payload)
        expect(sourcePayloadOf(payload)).toEqual({ sourceId: "s1", workspaceId: "ws1" })
    })

    it("refuses jobs with missing or nonstring identifiers", () => {
        for (const payload of [
            {},
            [],
            { workspaceId: "ws1" },
            { sourceId: 1, workspaceId: "ws1" },
            { sourceId: "s1", workspaceId: 1 },
        ]) {
            expect(sourcePayloadOf(payload)).toBeNull()
        }
    })
})

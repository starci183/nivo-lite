import { PROVIDER_EVENTS_SCHEMA, PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

describe("PROVIDER_STATUS_SCHEMA", () => {
    it("takes no argument", () => {
        expect(PROVIDER_STATUS_SCHEMA.parse({})).toEqual({})
        expect(PROVIDER_STATUS_SCHEMA.safeParse({ connectionId: "c" }).success).toBe(false)
    })
})

describe("PROVIDER_EVENTS_SCHEMA", () => {
    const connectionId = "11111111-1111-4111-8111-111111111111"

    it("takes a connection and supplies the default limit", () => {
        expect(PROVIDER_EVENTS_SCHEMA.parse({ connectionId })).toEqual({ connectionId, limit: 20 })
        expect(PROVIDER_EVENTS_SCHEMA.parse({ connectionId, limit: 50 })).toEqual({ connectionId, limit: 50 })
    })

    it.each([
        ["no connection", {}],
        ["a connection that is no uuid", { connectionId: "c1" }],
        ["a limit above fifty", { connectionId, limit: 51 }],
        ["a limit below one", { connectionId, limit: 0 }],
        ["a fractional limit", { connectionId, limit: 2.5 }],
        ["a workspace", { connectionId, workspaceId: "w1" }],
    ])("rejects %s", (_label, args) => {
        expect(PROVIDER_EVENTS_SCHEMA.safeParse(args).success).toBe(false)
    })
})

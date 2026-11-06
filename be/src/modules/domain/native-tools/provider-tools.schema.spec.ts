import { PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

describe("PROVIDER_STATUS_SCHEMA", () => {
    it("takes no argument", () => {
        expect(PROVIDER_STATUS_SCHEMA.parse({})).toEqual({})
        expect(PROVIDER_STATUS_SCHEMA.safeParse({ connectionId: "c" }).success).toBe(false)
    })
})

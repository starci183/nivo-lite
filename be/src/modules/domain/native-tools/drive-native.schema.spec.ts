import { DRIVE_SOURCES_LIST_SCHEMA, DRIVE_STATUS_SCHEMA } from "./drive-native.schema"

describe("DRIVE_STATUS_SCHEMA", () => {
    it("takes no argument", () => {
        expect(DRIVE_STATUS_SCHEMA.parse({})).toEqual({})
        expect(DRIVE_STATUS_SCHEMA.safeParse({ status: "ready" }).success).toBe(false)
    })
})

describe("DRIVE_SOURCES_LIST_SCHEMA", () => {
    it("supplies the default limit and takes a stage", () => {
        expect(DRIVE_SOURCES_LIST_SCHEMA.parse({})).toEqual({ limit: 20 })
        expect(DRIVE_SOURCES_LIST_SCHEMA.parse({ status: "failed", limit: 50 })).toEqual({
            status: "failed",
            limit: 50,
        })
    })

    it.each([
        ["an unknown stage", { status: "lost" }],
        ["a limit above fifty", { limit: 51 }],
        ["a limit below one", { limit: 0 }],
        ["a fractional limit", { limit: 1.5 }],
        ["an origin", { origin: "upload" }],
    ])("rejects %s", (_label, args) => {
        expect(DRIVE_SOURCES_LIST_SCHEMA.safeParse(args).success).toBe(false)
    })
})

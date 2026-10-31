import { DOSSIER_FINDINGS_LIST_SCHEMA, DOSSIER_STATUS_SCHEMA } from "./dossier-native.schema"

describe("DOSSIER_STATUS_SCHEMA", () => {
    it("takes no argument", () => {
        expect(DOSSIER_STATUS_SCHEMA.parse({})).toEqual({})
        expect(DOSSIER_STATUS_SCHEMA.safeParse({ dossierId: "d1" }).success).toBe(false)
    })
})

describe("DOSSIER_FINDINGS_LIST_SCHEMA", () => {
    const id = "11111111-1111-4111-8111-111111111111"

    it("supplies the default page size and takes every filter", () => {
        expect(DOSSIER_FINDINGS_LIST_SCHEMA.parse({})).toEqual({ first: 10 })
        expect(
            DOSSIER_FINDINGS_LIST_SCHEMA.parse({
                dossierId: id,
                statuses: ["open", "confirmed"],
                severities: ["critical"],
                first: 20,
                after: "cursor",
            }),
        ).toEqual({
            dossierId: id,
            statuses: ["open", "confirmed"],
            severities: ["critical"],
            first: 20,
            after: "cursor",
        })
    })

    it.each([
        ["a page above twenty", { first: 21 }],
        ["a page of none", { first: 0 }],
        ["a dossier that is no uuid", { dossierId: "d1" }],
        ["an unknown status", { statuses: ["lost"] }],
        ["an empty status list", { statuses: [] }],
        ["an unknown severity", { severities: ["urgent"] }],
        ["an empty cursor", { after: "" }],
        ["an assignee", { assigneeId: id }],
    ])("rejects %s", (_label, args) => {
        expect(DOSSIER_FINDINGS_LIST_SCHEMA.safeParse(args).success).toBe(false)
    })
})

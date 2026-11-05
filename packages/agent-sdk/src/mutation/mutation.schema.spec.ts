import { mutationSchema } from "./mutation.schema"
import { LEAD_ID, MEMBER_ID, VERSION } from "./mutation.fixture"

describe("mutationSchema", () => {
    it("parses every op", () => {
        const trees = [
            { op: "insert", entity: "demo.lead", values: { name: "a" } },
            { op: "insert", entity: "demo.lead", values: { name: "a" }, links: { owner: MEMBER_ID } },
            { op: "update", entity: "demo.lead", key: LEAD_ID, expected: VERSION, values: { name: "b" } },
            { op: "upsert", entity: "demo.lead", on: "lead_phone", values: { name: "a" } },
            { op: "delete", entity: "demo.run", key: LEAD_ID },
            { op: "delete", entity: "demo.run", key: LEAD_ID, expected: VERSION },
            { op: "ensure", entity: "demo.lead", match: "by_phone", values: { phone: "1" } },
            { op: "link", entity: "demo.lead", key: LEAD_ID, relation: "notes", to: MEMBER_ID },
            { op: "unlink", entity: "demo.lead", key: LEAD_ID, relation: "notes", to: MEMBER_ID },
        ]
        for (const tree of trees) expect(mutationSchema.safeParse(tree).success).toBe(true)
    })

    it("refuses an unknown op, an unknown member and an unbounded or malformed token", () => {
        expect(mutationSchema.safeParse({ op: "drop", entity: "demo.lead" }).success).toBe(false)
        expect(mutationSchema.safeParse({ op: "insert", entity: "demo.lead", values: {}, sql: "x" }).success).toBe(
            false,
        )
        expect(mutationSchema.safeParse({ op: "delete", entity: "demo.run", key: "not-a-uuid" }).success).toBe(false)
        expect(
            mutationSchema.safeParse({ op: "update", entity: "demo.lead", key: LEAD_ID, expected: "", values: {} })
                .success,
        ).toBe(false)
        expect(
            mutationSchema.safeParse({ op: "update", entity: "demo.lead", key: LEAD_ID, expected: "1x", values: {} })
                .success,
        ).toBe(false)
        expect(
            mutationSchema.safeParse({ op: "insert", entity: "demo.lead", values: {}, links: { owner: "x" } }).success,
        ).toBe(false)
    })
})

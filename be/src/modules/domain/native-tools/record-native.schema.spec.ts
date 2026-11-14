import { Test } from "@nestjs/testing"
import { RECORD_CREATE_SCHEMA, RECORD_UPDATE_SCHEMA } from "./record-native.schema"

const SUBJECT = Symbol("record-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { RECORD_CREATE_SCHEMA, RECORD_UPDATE_SCHEMA } }],
    }).compile()
    return moduleRef.get<{
        RECORD_CREATE_SCHEMA: typeof RECORD_CREATE_SCHEMA
        RECORD_UPDATE_SCHEMA: typeof RECORD_UPDATE_SCHEMA
    }>(SUBJECT)
}

const fields = (count: number): Record<string, number> =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`f${String(index)}`, index]))

describe("the field values of a record write", () => {
    it("take JSON of any kind and depth in a field (a jsonb field)", async () => {
        const { RECORD_CREATE_SCHEMA: schema } = await build()
        const values = { title: "x".repeat(100_000), tags: ["a", "b"], layout: { rows: [{ cells: [[1, 2], [3]] }] }, none: null }
        expect(schema.safeParse({ type: "pkg.agent.thing", values }).success).toBe(true)
    })

    it("refuse a write of 1001 fields on create and on update, and accept 1000", async () => {
        const { RECORD_CREATE_SCHEMA: create, RECORD_UPDATE_SCHEMA: update } = await build()
        const type = "pkg.agent.thing"
        expect(create.safeParse({ type, values: fields(1000) }).success).toBe(true)
        expect(create.safeParse({ type, values: fields(1001) }).success).toBe(false)
        expect(update.safeParse({ type, id: "r1", patch: fields(1001) }).success).toBe(false)
    })

    it("refuse a field value that is not JSON", async () => {
        const { RECORD_CREATE_SCHEMA: schema } = await build()
        expect(schema.safeParse({ type: "pkg.agent.thing", values: { at: undefined } }).success).toBe(false)
    })
})

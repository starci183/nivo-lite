import { Test } from "@nestjs/testing"
import { jsonBodySchema, jsonRecordSchema } from "./json-body.schema"

const SUBJECT = Symbol("json-body.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { jsonBodySchema, jsonRecordSchema } }],
    }).compile()
    return moduleRef.get<{ jsonBodySchema: typeof jsonBodySchema; jsonRecordSchema: typeof jsonRecordSchema }>(SUBJECT)
}

describe("jsonBodySchema", () => {
    it("accepts a deep value of every JSON kind, at the largest string it allows", async () => {
        const { jsonBodySchema: schema } = await build()
        const deep = { rows: [{ id: "a", note: "x".repeat(1_048_576), flags: [true, false, null], nested: { n: 1.5, more: [[[{ k: "v" }]]] } }] }
        expect(schema.safeParse(deep).success).toBe(true)
    })

    it("refuses a string past the bound, a list past the bound and an object with too many entries", async () => {
        const { jsonBodySchema: schema } = await build()
        const entries = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`k${String(index)}`, 1]))
        expect(schema.safeParse("x".repeat(1_048_577)).success).toBe(false)
        expect(schema.safeParse(Array.from({ length: 10_001 }, () => 0)).success).toBe(false)
        expect(schema.safeParse(entries).success).toBe(false)
    })

    it("refuses a value that is not JSON", async () => {
        const { jsonBodySchema: schema } = await build()
        expect(schema.safeParse(undefined).success).toBe(false)
        expect(schema.safeParse({ at: new Date(0) }).success).toBe(false)
    })
})

describe("jsonRecordSchema", () => {
    it("takes an object of the largest allowed key and entry count, and refuses a longer key or one more entry", async () => {
        const { jsonRecordSchema: schema } = await build()
        const full = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`k${String(index)}`, index]))
        expect(schema.safeParse(full).success).toBe(true)
        expect(schema.safeParse({ [`k${"x".repeat(199)}`]: 1 }).success).toBe(true)
        expect(schema.safeParse({ [`k${"x".repeat(200)}`]: 1 }).success).toBe(false)
        expect(schema.safeParse({ ...full, extra: 1 }).success).toBe(false)
    })

    it("refuses a list at the top", async () => {
        const { jsonRecordSchema: schema } = await build()
        expect(schema.safeParse([1, 2]).success).toBe(false)
    })
})

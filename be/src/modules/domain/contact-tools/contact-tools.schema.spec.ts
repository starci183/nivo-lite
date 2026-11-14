import { Test } from "@nestjs/testing"
import { CONTACT_REMEMBER_SCHEMA } from "./contact-tools.schema"

const SUBJECT = Symbol("contact-tools.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { CONTACT_REMEMBER_SCHEMA } }],
    }).compile()
    return moduleRef.get<{ CONTACT_REMEMBER_SCHEMA: typeof CONTACT_REMEMBER_SCHEMA }>(SUBJECT)
}

describe("the facts a run remembers about a contact", () => {
    it("take JSON values of any kind: text, numbers, lists and objects", async () => {
        const { CONTACT_REMEMBER_SCHEMA: schema } = await build()
        const facts = { size: "M", visits: 3, likes: ["silk", "linen"], address: { city: "Hue", floor: null } }
        expect(schema.safeParse({ facts }).success).toBe(true)
    })

    it("refuse a text value past one megabyte and more than 20 facts", async () => {
        const { CONTACT_REMEMBER_SCHEMA: schema } = await build()
        const facts = (count: number): Record<string, number> =>
            Object.fromEntries(Array.from({ length: count }, (_, index) => [`f${String(index)}`, index]))
        expect(schema.safeParse({ facts: { note: "n".repeat(1_048_577) } }).success).toBe(false)
        expect(schema.safeParse({ facts: facts(20) }).success).toBe(true)
        expect(schema.safeParse({ facts: facts(21) }).success).toBe(false)
    })
})

import { Test } from "@nestjs/testing"
import { masked, argsHashOf, summaryOf } from "./audit-mask.policy"

/** The members of the subject under test. */
interface Subject {
    readonly masked: typeof masked
    readonly argsHashOf: typeof argsHashOf
    readonly summaryOf: typeof summaryOf
}

const SUBJECT = Symbol("audit-mask.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { masked, argsHashOf, summaryOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("audit-mask.policy", () => {
    it("masks secret members at any depth and the tool's own", async () => {
        const subject = await build()
        const value = { code: "1234", stay: { key_code: "9", room: "302" }, list: [{ apiKey: "x" }, 3], pin2: "a" }
        expect(subject.masked(value, ["pin2", "key_code"])).toEqual({
            code: "***",
            stay: { key_code: "***", room: "302" },
            list: [{ apiKey: "***" }, 3],
            pin2: "***",
        })
        expect(subject.masked({ a: null })).toEqual({ a: null })
    })

    it("hashes the arguments independent of key order", async () => {
        const subject = await build()
        expect(subject.argsHashOf({ a: 1, b: [{ d: 1, c: 2 }] })).toBe(
            subject.argsHashOf({ b: [{ c: 2, d: 1 }], a: 1 }),
        )
        expect(subject.argsHashOf({ a: 1 })).toMatch(/^[0-9a-f]{64}$/u)
    })

    it("bounds and masks the summary", async () => {
        const subject = await build()
        expect(subject.summaryOf({ code: "1234", validUntil: "x" })).toBe('{"code":"***","validUntil":"x"}')
        expect(subject.summaryOf({ text: "y".repeat(1000) })).toHaveLength(400)
    })
})

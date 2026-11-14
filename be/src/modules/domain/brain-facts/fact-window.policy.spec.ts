import { Test } from "@nestjs/testing"
import { hasStatedPeriod, windowsArgue } from "./fact-window.policy"

const SUBJECT = Symbol("fact-window.policy")
interface Subject {
    readonly hasStatedPeriod: typeof hasStatedPeriod
    readonly windowsArgue: typeof windowsArgue
}
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { hasStatedPeriod, windowsArgue } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const STANDING = { validFrom: null, validTo: null }
const FIRST = { validFrom: "2030-02-12T00:00:00.000Z", validTo: "2030-02-15T00:00:00.000Z" }
const SECOND = { validFrom: "2030-03-06T00:00:00.000Z", validTo: "2030-03-09T00:00:00.000Z" }
const ACROSS = { validFrom: "2030-02-14T00:00:00.000Z", validTo: "2030-03-07T00:00:00.000Z" }
/** A truth in force with the default end nobody stated: one calendar year after its start. */
const IN_FORCE_DEFAULT = { validFrom: "2029-06-01T00:00:00.000Z", validTo: "2030-06-01T00:00:00.000Z" }

describe("fact-window.policy: whether two values of one key argue once their periods are read", () => {
    it("a stated end is a period; no end, or the one-year default of a truth in force, is a standing value", async () => {
        const policy = await buildSubject()
        expect(policy.hasStatedPeriod(FIRST)).toBe(true)
        expect(policy.hasStatedPeriod(STANDING)).toBe(false)
        expect(policy.hasStatedPeriod(IN_FORCE_DEFAULT)).toBe(false)
        expect(policy.hasStatedPeriod({ validTo: "2030-02-15T00:00:00.000Z" })).toBe(true)
        expect(policy.hasStatedPeriod({})).toBe(false)
    })

    it("a period over a standing value never argues; a standing value argues with any other value in force and with a standing one that waits", async () => {
        const policy = await buildSubject()
        expect(policy.windowsArgue(FIRST, STANDING, true)).toBe(false)
        expect(policy.windowsArgue(FIRST, IN_FORCE_DEFAULT, true)).toBe(false)
        expect(policy.windowsArgue(STANDING, IN_FORCE_DEFAULT, true)).toBe(true)
        expect(policy.windowsArgue(STANDING, FIRST, true)).toBe(true)
        expect(policy.windowsArgue(STANDING, STANDING, false)).toBe(true)
        expect(policy.windowsArgue(STANDING, FIRST, false)).toBe(false)
    })

    it("two periods argue only when they overlap", async () => {
        const policy = await buildSubject()
        expect(policy.windowsArgue(FIRST, SECOND, true)).toBe(false)
        expect(policy.windowsArgue(FIRST, ACROSS, false)).toBe(true)
        expect(policy.windowsArgue(ACROSS, SECOND, true)).toBe(true)
    })
})

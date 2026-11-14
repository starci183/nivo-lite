import { Test } from "@nestjs/testing"
import { argueInTime, arguesInTime } from "./critic-window.policy"

const SUBJECT = Symbol("critic-window.policy")
interface Subject {
    readonly argueInTime: typeof argueInTime
    readonly arguesInTime: typeof arguesInTime
}
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { argueInTime, arguesInTime } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const STANDING = { validFrom: null, validTo: null }
const DECEMBER = { validFrom: "2026-12-01T00:00:00.000Z", validTo: "2026-12-31T00:00:00.000Z" }
const JANUARY = { validFrom: "2027-01-01T00:00:00.000Z", validTo: "2027-01-31T00:00:00.000Z" }
const NEW_YEAR = { validFrom: "2026-12-20T00:00:00.000Z", validTo: "2027-01-05T00:00:00.000Z" }
/** A truth in force with the default end: one calendar year after its start, which nobody stated. */
const IN_FORCE_DEFAULT = { validFrom: "2026-03-01T00:00:00.000Z", validTo: "2027-03-01T00:00:00.000Z" }

describe("critic-window.policy: whether two values of one key argue once their periods are read", () => {
    it("a period over a standing value never argues; a standing value argues with any other value in force and with a standing one that waits", async () => {
        const policy = await buildSubject()
        expect(policy.arguesInTime(DECEMBER, STANDING, true)).toBe(false)
        expect(policy.arguesInTime(DECEMBER, IN_FORCE_DEFAULT, true)).toBe(false)
        expect(policy.arguesInTime(STANDING, IN_FORCE_DEFAULT, true)).toBe(true)
        expect(policy.arguesInTime(STANDING, DECEMBER, true)).toBe(true)
        expect(policy.arguesInTime(STANDING, STANDING, false)).toBe(true)
        expect(policy.arguesInTime(STANDING, DECEMBER, false)).toBe(false)
    })

    it("two periods argue only when they overlap", async () => {
        const policy = await buildSubject()
        expect(policy.arguesInTime(DECEMBER, JANUARY, true)).toBe(false)
        expect(policy.arguesInTime(DECEMBER, NEW_YEAR, false)).toBe(true)
        expect(policy.arguesInTime(NEW_YEAR, JANUARY, true)).toBe(true)
    })

    it("two waiting values of one document argue in either direction: two standing values, or two overlapping periods; never a period beside the standing value", async () => {
        const policy = await buildSubject()
        expect(policy.argueInTime(STANDING, STANDING)).toBe(true)
        expect(policy.argueInTime(DECEMBER, NEW_YEAR)).toBe(true)
        expect(policy.argueInTime(DECEMBER, JANUARY)).toBe(false)
        expect(policy.argueInTime(DECEMBER, STANDING)).toBe(false)
        expect(policy.argueInTime(STANDING, DECEMBER)).toBe(false)
    })
})

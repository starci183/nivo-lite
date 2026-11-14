import { Test } from "@nestjs/testing"
import { WAKE_SOURCE_KEY, breakerOpen } from "./wake-rules.policy"

const SUBJECT = Symbol("wake-rules.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { breakerOpen } }],
    }).compile()
    return moduleRef.get<typeof import("./wake-rules.policy")>(SUBJECT)
}

const NOW = new Date("2026-11-10T03:00:00.000Z")

describe("WAKE_SOURCE_KEY", () => {
    it("is the key shape the database checks", () => {
        expect(WAKE_SOURCE_KEY.test("generic_webhook")).toBe(true)
        expect(WAKE_SOURCE_KEY.test("Generic")).toBe(false)
    })
})

describe("breakerOpen", () => {
    it("is open until the moment it names", async () => {
        const { breakerOpen } = await buildSubject()

        expect(breakerOpen(new Date(NOW.getTime() + 1), NOW)).toBe(true)
        expect(breakerOpen(NOW, NOW)).toBe(false)
    })

    it("is closed when it was never opened", async () => {
        const { breakerOpen } = await buildSubject()

        expect(breakerOpen(null, NOW)).toBe(false)
    })
})

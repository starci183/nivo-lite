import { Test } from "@nestjs/testing"
import { RECENT_EVENTS, windowAt as realWindowAt } from "./overview.policy"

const SUBJECT = Symbol("overview.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { windowAt: realWindowAt } }],
    }).compile()
    const subject = moduleRef.get<{ windowAt: typeof realWindowAt }>(SUBJECT)
    return subject.windowAt
}

const NOW = new Date("2026-10-13T03:00:00.000Z")

describe("overview policy", () => {
    it("reads the last 7 days and the founding offer at the given instant", async () => {
        const windowAt = await buildSubject()

        expect(RECENT_EVENTS).toBe(6)
        expect(windowAt(NOW)).toEqual({
            since7: "2026-10-06T03:00:00.000Z",
            foundingFrom: "2026-09-28T17:00:00.000Z",
            foundingTo: "2026-10-31T16:59:59.000Z",
        })
    })
})

import { Test } from "@nestjs/testing"
import { extendedPaidUntil } from "./billing.policy"

const SUBJECT = Symbol("billing.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { extendedPaidUntil } }],
    }).compile()
    return moduleRef.get<typeof import("./billing.policy")>(SUBJECT)
}

const NOW = new Date("2026-10-12T00:00:00.000Z")

describe("billing policy", () => {
    describe("extendedPaidUntil", () => {
        it("counts from now when there is no subscription", async () => {
            const subject = await buildSubject()

            expect(subject.extendedPaidUntil(null, NOW, 30).toISOString()).toBe("2026-11-11T00:00:00.000Z")
        })

        it("counts from now when the subscription lapsed", async () => {
            const subject = await buildSubject()

            expect(subject.extendedPaidUntil(new Date("2026-10-01T00:00:00.000Z"), NOW, 1).toISOString()).toBe(
                "2026-10-13T00:00:00.000Z",
            )
        })

        it("counts from the current end while the subscription runs", async () => {
            const subject = await buildSubject()

            expect(subject.extendedPaidUntil(new Date("2026-12-01T00:00:00.000Z"), NOW, 10).toISOString()).toBe(
                "2026-12-11T00:00:00.000Z",
            )
        })
    })
})

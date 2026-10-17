import { Test } from "@nestjs/testing"
import { PRORATION_PERIOD_DAYS, VND_STEP, prorateUpgrade } from "./proration.policy"

const NOW = new Date("2026-10-12T10:00:00.000Z")

const SUBJECT = Symbol("proration.policy")
type Subject = Pick<typeof import("./proration.policy"), "prorateUpgrade">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    prorateUpgrade,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("upgrade proration", () => {
    it("uses a thirty-day period and rounds charges down to one thousand VND", async () => {
        const subject = await build()
        expect(PRORATION_PERIOD_DAYS).toBe(30)
        expect(VND_STEP).toBe(1000)
        expect(
            subject.prorateUpgrade({
                currentPrice: 990000,
                targetPrice: 1990999,
                paidUntil: "2026-10-27T10:00:00.000Z",
                now: NOW,
            }),
        ).toEqual({ amount: 1495000, credit: 495000, daysLeft: 15 })
    })

    it("rounds a part of a day up and answers the credit rounded to a whole VND", async () => {
        const subject = await build()
        expect(
            subject.prorateUpgrade({
                currentPrice: 10000,
                targetPrice: 3000,
                paidUntil: "2026-10-12T10:00:00.001Z",
                now: NOW,
            }),
        ).toEqual({ amount: 2000, credit: 333, daysLeft: 1 })
    })

    it.each(["2026-10-12T10:00:00.000Z", "2026-10-11T10:00:00.000Z", "unreadable"])(
        "gives no unused credit for a period ending at %s",
        async (paidUntil) => {
            const subject = await build()
            const input = { currentPrice: 990000, targetPrice: 1990999, paidUntil, now: NOW }
            expect(subject.prorateUpgrade(input)).toEqual({
                amount: 1990000,
                credit: 0,
                daysLeft: 0,
            })
        },
    )

    it("keeps all prepaid days and never charges a negative amount", async () => {
        const subject = await build()
        expect(
            subject.prorateUpgrade({
                currentPrice: 990000,
                targetPrice: 1990000,
                paidUntil: "2026-12-12T10:00:00.000Z",
                now: NOW,
            }),
        ).toEqual({ amount: 0, credit: 2013000, daysLeft: 61 })
    })
})

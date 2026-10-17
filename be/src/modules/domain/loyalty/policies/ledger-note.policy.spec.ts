import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { PointsCalc } from "@modules/domain/loyalty-ledger"
import { earnNoteParts, redeemCode } from "./ledger-note.policy"

const calcOf = builder<PointsCalc>({
    points: 10,
    rate: 1,
    label: "",
    multiplier: 1,
    tierName: "",
    perVisit: 0,
    belowMinimum: false,
})

const SUBJECT = Symbol("ledger-note.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { earnNoteParts, redeemCode } }],
    }).compile()
    return moduleRef.get<{ earnNoteParts: typeof earnNoteParts; redeemCode: typeof redeemCode }>(SUBJECT)
}

describe("ledger-note.policy", () => {
    describe("earnNoteParts", () => {
        it("tells the rate alone for a plain purchase", async () => {
            const subject = await buildSubject()

            expect(subject.earnNoteParts(calcOf())).toEqual([{ key: "loyalty.earn.rate", params: { rate: 1 } }])
        })

        it("names the category that raised the rate", async () => {
            const subject = await buildSubject()

            expect(subject.earnNoteParts(calcOf({ rate: 3, label: "Coffee" }))).toEqual([
                { key: "loyalty.earn.rateCategory", params: { rate: 3, label: "Coffee" } },
            ])
        })

        it("adds the tier bonus and the points of the visit", async () => {
            const subject = await buildSubject()

            expect(subject.earnNoteParts(calcOf({ multiplier: 1.5, tierName: "Silver", perVisit: 5 }))).toEqual([
                { key: "loyalty.earn.rate", params: { rate: 1 } },
                { key: "loyalty.earn.tier", params: { tier: "Silver", multiplier: 1.5 } },
                { key: "loyalty.earn.visit", params: { points: 5 } },
            ])
        })
    })

    describe("redeemCode", () => {
        it("takes the last six letters and digits of the key in capitals", async () => {
            const subject = await buildSubject()

            expect(subject.redeemCode("redeem:ab-12cd34-ef")).toBe("QT-CD34EF")
        })

        it("pads a short key with zeros", async () => {
            const subject = await buildSubject()

            expect(subject.redeemCode("a1")).toBe("QT-0000A1")
        })
    })
})

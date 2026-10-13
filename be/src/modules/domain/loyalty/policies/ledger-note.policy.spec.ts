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

describe("ledger-note.policy", () => {
    describe("earnNoteParts", () => {
        it("tells the rate alone for a plain purchase", () => {
            expect(earnNoteParts(calcOf())).toEqual([{ key: "loyalty.earn.rate", params: { rate: 1 } }])
        })

        it("names the category that raised the rate", () => {
            expect(earnNoteParts(calcOf({ rate: 3, label: "Coffee" }))).toEqual([
                { key: "loyalty.earn.rateCategory", params: { rate: 3, label: "Coffee" } },
            ])
        })

        it("adds the tier bonus and the points of the visit", () => {
            expect(earnNoteParts(calcOf({ multiplier: 1.5, tierName: "Silver", perVisit: 5 }))).toEqual([
                { key: "loyalty.earn.rate", params: { rate: 1 } },
                { key: "loyalty.earn.tier", params: { tier: "Silver", multiplier: 1.5 } },
                { key: "loyalty.earn.visit", params: { points: 5 } },
            ])
        })
    })

    describe("redeemCode", () => {
        it("takes the last six letters and digits of the key in capitals", () => {
            expect(redeemCode("redeem:ab-12cd34-ef")).toBe("QT-CD34EF")
        })

        it("pads a short key with zeros", () => {
            expect(redeemCode("a1")).toBe("QT-0000A1")
        })
    })
})

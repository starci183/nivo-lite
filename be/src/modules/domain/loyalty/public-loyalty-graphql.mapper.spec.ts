import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import type { PublicCheckCode, PublicPoints } from "./loyalty.contracts"
import { toRequestLoyaltyCodeType, toVerifyLoyaltyCodeType } from "./public-loyalty-graphql.mapper"

const REFUSALS: ReadonlyArray<readonly [PublicCheckCode, LoyaltyErrorCode]> = [
    ["bad_phone", LoyaltyErrorCode.PhoneInvalid],
    ["closed", LoyaltyErrorCode.PageNotFound],
    ["busy", LoyaltyErrorCode.CodeBusy],
    ["wrong", LoyaltyErrorCode.CodeWrong],
]
const POINTS: PublicPoints = {
    shop: "Anna Spa",
    name: "Mai",
    tierName: "Silver",
    points: 600,
    nextTier: null,
    expiring: { points: 50, firstAt: "2026-02-01T00:00:00.000Z" },
    rewards: [{ name: "Voucher", pointsCost: 500, note: "At the counter", canRedeem: true }],
}

describe("public loyalty GraphQL mapping", () => {
    describe("toRequestLoyaltyCodeType", () => {
        it.each([true, false])("acknowledges an accepted request without exposing membership when ok is %s", (ok) => {
            expect(toRequestLoyaltyCodeType({ ok, code: "none" })).toEqual({ code: "none" })
        })

        it.each(REFUSALS)("promotes the %s refusal to the %s domain error", (code, expected) => {
            expect(() => toRequestLoyaltyCodeType({ ok: false, code })).toThrow(new LoyaltyError({ code: expected }))
            expect(() => toRequestLoyaltyCodeType({ ok: false, code })).toThrow(
                expect.objectContaining({ code: expected, params: {} }),
            )
        })
    })

    describe("toVerifyLoyaltyCodeType", () => {
        it("returns the unlocked points for an accepted verification", () => {
            expect(toVerifyLoyaltyCodeType({ ok: true, code: "none", points: POINTS })).toEqual({
                code: "none",
                points: POINTS,
            })
        })

        it.each(REFUSALS)("promotes the %s verification refusal to the %s domain error", (code, expected) => {
            expect(() => toVerifyLoyaltyCodeType({ ok: false, code, points: null })).toThrow(
                new LoyaltyError({ code: expected }),
            )
            expect(() => toVerifyLoyaltyCodeType({ ok: false, code, points: null })).toThrow(
                expect.objectContaining({ code: expected, params: {} }),
            )
        })

        it("refuses an accepted answer that did not unlock points", () => {
            expect(() => toVerifyLoyaltyCodeType({ ok: true, code: "none", points: null })).toThrow(
                expect.objectContaining({ code: LoyaltyErrorCode.CodeWrong, params: {} }),
            )
        })
    })
})

import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("public-loyalty-graphql.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toRequestLoyaltyCodeType, toVerifyLoyaltyCodeType } }],
    }).compile()
    return moduleRef.get<{
        toRequestLoyaltyCodeType: typeof toRequestLoyaltyCodeType
        toVerifyLoyaltyCodeType: typeof toVerifyLoyaltyCodeType
    }>(SUBJECT)
}

describe("public loyalty GraphQL mapping", () => {
    describe("toRequestLoyaltyCodeType", () => {
        it.each([true, false])(
            "acknowledges an accepted request without exposing membership when ok is %s",
            async (ok) => {
                const subject = await buildSubject()

                expect(subject.toRequestLoyaltyCodeType({ ok, code: "none" })).toEqual({ code: "none" })
            },
        )

        it.each(REFUSALS)("promotes the %s refusal to the %s domain error", async (code, expected) => {
            const subject = await buildSubject()

            expect(() => subject.toRequestLoyaltyCodeType({ ok: false, code })).toThrow(
                new LoyaltyError({ code: expected }),
            )
            expect(() => subject.toRequestLoyaltyCodeType({ ok: false, code })).toThrow(
                expect.objectContaining({ code: expected, params: {} }),
            )
        })
    })

    describe("toVerifyLoyaltyCodeType", () => {
        it("returns the unlocked points for an accepted verification", async () => {
            const subject = await buildSubject()

            expect(subject.toVerifyLoyaltyCodeType({ ok: true, code: "none", points: POINTS })).toEqual({
                code: "none",
                points: POINTS,
            })
        })

        it.each(REFUSALS)("promotes the %s verification refusal to the %s domain error", async (code, expected) => {
            const subject = await buildSubject()

            expect(() => subject.toVerifyLoyaltyCodeType({ ok: false, code, points: null })).toThrow(
                new LoyaltyError({ code: expected }),
            )
            expect(() => subject.toVerifyLoyaltyCodeType({ ok: false, code, points: null })).toThrow(
                expect.objectContaining({ code: expected, params: {} }),
            )
        })

        it("refuses an accepted answer that did not unlock points", async () => {
            const subject = await buildSubject()

            expect(() => subject.toVerifyLoyaltyCodeType({ ok: true, code: "none", points: null })).toThrow(
                expect.objectContaining({ code: LoyaltyErrorCode.CodeWrong, params: {} }),
            )
        })
    })
})

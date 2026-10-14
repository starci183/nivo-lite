import { builder } from "@starci/jest-preset"
import type { Plan, PlanSelection } from "./billing.contracts"
import { BillingErrorCode } from "./errors/billing.error"
import { promoAvailable, quoteSelection } from "./pricing.policy"

const planOf = builder<Plan>({
    code: "solo",
    nameVi: "Ca nhan",
    nameEn: "Solo",
    priceVnd: 100000,
    period: "month",
    seats: 3,
    features: { vi: [], en: [] },
    sort: 1,
    aiCreditsPerMonth: 500,
    isCustom: false,
    priceAnnualVnd: 1000000,
    annualDiscountPct: 15,
    promoPriceVnd: 50000,
    promoMonths: 3,
    storageGb: 5,
    individual: true,
    perSeat: false,
    listed: true,
    tiers: [
        { creditsPerMonth: 100, priceVnd: 30000, perSeat: true },
        { creditsPerMonth: 500, priceVnd: 100001, perSeat: true },
    ],
    packs: [],
})

const selectionOf = builder<PlanSelection>({ cycle: "monthly", tierCredits: null, seats: 1 })
const NEW_CUSTOMER = { fullPricePayments: 0, promoPayments: 0 }

describe("pricing policy", () => {
    describe("promoAvailable", () => {
        it("offers the last remaining intro month to a customer who has only paid intro prices", () => {
            expect(promoAvailable(planOf(), { fullPricePayments: 0, promoPayments: 2 })).toBe(true)
        })

        it.each([
            ["no intro price", { promoPriceVnd: null }, NEW_CUSTOMER],
            ["no intro allowance", { promoMonths: null }, NEW_CUSTOMER],
            ["a prior full-price payment", {}, { fullPricePayments: 1, promoPayments: 0 }],
            ["all intro months used", {}, { fullPricePayments: 0, promoPayments: 3 }],
        ] as const)("refuses the intro price for %s", (_reason, changes, history) => {
            expect(promoAvailable(planOf(changes), history)).toBe(false)
        })
    })

    describe("quoteSelection", () => {
        it("quotes an individual customer's intro month using the catalogue price and fixed allowance", () => {
            expect(quoteSelection(planOf(), selectionOf({ seats: 999 }), NEW_CUSTOMER)).toEqual({
                planCode: "solo",
                cycle: "monthly",
                months: 1,
                amountVnd: 50000,
                listMonthlyVnd: 100000,
                promo: true,
                tierCredits: null,
                seats: 1,
                creditsPerMonth: 500,
            })
        })

        it("accepts an explicit individual allowance and charges full price after the intro months", () => {
            expect(
                quoteSelection(planOf(), selectionOf({ tierCredits: 500 }), { fullPricePayments: 0, promoPayments: 3 }),
            ).toEqual({
                planCode: "solo",
                cycle: "monthly",
                months: 1,
                amountVnd: 100000,
                listMonthlyVnd: 100000,
                promo: false,
                tierCredits: null,
                seats: 1,
                creditsPerMonth: 500,
            })
        })

        it("keeps unlimited credits and the twelve-month period of a yearly plan sold at its period price", () => {
            expect(
                quoteSelection(
                    planOf({ aiCreditsPerMonth: null, period: "year", promoPriceVnd: null }),
                    selectionOf(),
                    NEW_CUSTOMER,
                ),
            ).toEqual({
                planCode: "solo",
                cycle: "monthly",
                months: 12,
                amountVnd: 100000,
                listMonthlyVnd: 100000,
                promo: false,
                tierCredits: null,
                seats: 1,
                creditsPerMonth: null,
            })
        })

        it("quotes an individual's annual catalogue price without the intro discount", () => {
            expect(quoteSelection(planOf(), selectionOf({ cycle: "annual" }), NEW_CUSTOMER)).toEqual({
                planCode: "solo",
                cycle: "annual",
                months: 12,
                amountVnd: 1000000,
                listMonthlyVnd: 100000,
                promo: false,
                tierCredits: null,
                seats: 1,
                creditsPerMonth: 500,
            })
        })

        it("multiplies the selected tier's price and credits by paid seats without an intro discount", () => {
            expect(
                quoteSelection(planOf({ perSeat: true }), selectionOf({ tierCredits: 500, seats: 3 }), NEW_CUSTOMER),
            ).toEqual({
                planCode: "solo",
                cycle: "monthly",
                months: 1,
                amountVnd: 300003,
                listMonthlyVnd: 300003,
                promo: false,
                tierCredits: 500,
                seats: 3,
                creditsPerMonth: 1500,
            })
        })

        it("floors the discounted annual price of every paid seat", () => {
            expect(
                quoteSelection(
                    planOf({ perSeat: true }),
                    selectionOf({ cycle: "annual", tierCredits: 500, seats: 3 }),
                    NEW_CUSTOMER,
                ),
            ).toEqual({
                planCode: "solo",
                cycle: "annual",
                months: 12,
                amountVnd: 3060030,
                listMonthlyVnd: 300003,
                promo: false,
                tierCredits: 500,
                seats: 3,
                creditsPerMonth: 1500,
            })
        })

        it("refuses to quote a contract plan", () => {
            expect(() => quoteSelection(planOf({ isCustom: true }), selectionOf(), NEW_CUSTOMER)).toThrow(
                expect.objectContaining({ code: BillingErrorCode.PlanCustom }),
            )
        })

        it("refuses a changed allowance on an individual plan", () => {
            expect(() => quoteSelection(planOf(), selectionOf({ tierCredits: 100 }), NEW_CUSTOMER)).toThrow(
                expect.objectContaining({ code: BillingErrorCode.TierUnknown }),
            )
        })

        it("requires a credit tier for a per-seat plan", () => {
            expect(() => quoteSelection(planOf({ perSeat: true }), selectionOf(), NEW_CUSTOMER)).toThrow(
                expect.objectContaining({ code: BillingErrorCode.TierRequired }),
            )
        })

        it("refuses a tier absent from the per-seat catalogue", () => {
            expect(() =>
                quoteSelection(planOf({ perSeat: true }), selectionOf({ tierCredits: 999 }), NEW_CUSTOMER),
            ).toThrow(expect.objectContaining({ code: BillingErrorCode.TierUnknown }))
        })

        it.each([0.5, 0, -1, 4])("refuses invalid paid seats %p and reports the plan maximum", (seats) => {
            expect(() =>
                quoteSelection(planOf({ perSeat: true }), selectionOf({ tierCredits: 500, seats }), NEW_CUSTOMER),
            ).toThrow(expect.objectContaining({ code: BillingErrorCode.SeatsInvalid, params: { max: 3 } }))
        })

        it.each([{ priceAnnualVnd: null }, { annualDiscountPct: null }])(
            "refuses an annual cycle missing catalogue terms %p",
            (changes) => {
                expect(() => quoteSelection(planOf(changes), selectionOf({ cycle: "annual" }), NEW_CUSTOMER)).toThrow(
                    expect.objectContaining({ code: BillingErrorCode.CycleUnavailable }),
                )
            },
        )
    })
})

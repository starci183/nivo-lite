import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import type { Plan, PlanSelection } from "./billing.contracts"

import { BillingErrorCode } from "./errors/billing.error"

import { promoAvailable as realPromoAvailable, quoteSelection as realQuoteSelection } from "./pricing.policy"

const SUBJECT = Symbol("pricing.policy")

type Subject = {
    promoAvailable: typeof realPromoAvailable
    quoteSelection: typeof realQuoteSelection
}

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

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { promoAvailable: realPromoAvailable, quoteSelection: realQuoteSelection },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("pricing policy > promoAvailable", () => {
    it("offers the last remaining intro month to a customer who has only paid intro prices", async () => {
        const { subject } = await buildSubject()

        expect(subject.promoAvailable(planOf(), { fullPricePayments: 0, promoPayments: 2 })).toBe(true)
    })

    it.each([
        ["no intro price", { promoPriceVnd: null }, NEW_CUSTOMER],
        ["no intro allowance", { promoMonths: null }, NEW_CUSTOMER],
        ["a prior full-price payment", {}, { fullPricePayments: 1, promoPayments: 0 }],
        ["all intro months used", {}, { fullPricePayments: 0, promoPayments: 3 }],
    ] as const)("refuses the intro price for %s", async (_reason, changes, history) => {
        const { subject } = await buildSubject()

        expect(subject.promoAvailable(planOf(changes), history)).toBe(false)
    })
})

describe("pricing policy > quoteSelection", () => {
    it("quotes an individual customer's intro month using the catalogue price and fixed allowance", async () => {
        const { subject } = await buildSubject()

        expect(subject.quoteSelection(planOf(), selectionOf({ seats: 999 }), NEW_CUSTOMER)).toEqual({
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

    it("accepts an explicit individual allowance and charges full price after the intro months", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.quoteSelection(planOf(), selectionOf({ tierCredits: 500 }), {
                fullPricePayments: 0,
                promoPayments: 3,
            }),
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

    it("keeps unlimited credits and the twelve-month period of a yearly plan sold at its period price", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.quoteSelection(
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

    it("quotes an individual's annual catalogue price without the intro discount", async () => {
        const { subject } = await buildSubject()

        expect(subject.quoteSelection(planOf(), selectionOf({ cycle: "annual" }), NEW_CUSTOMER)).toEqual({
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
})

describe("pricing policy > quoteSelection", () => {
    it("multiplies the selected tier's price and credits by paid seats without an intro discount", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.quoteSelection(
                planOf({ perSeat: true }),
                selectionOf({ tierCredits: 500, seats: 3 }),
                NEW_CUSTOMER,
            ),
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
    it("floors the discounted annual price of every paid seat", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.quoteSelection(
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
    it("refuses to quote a contract plan", async () => {
        const { subject } = await buildSubject()

        expect(() => subject.quoteSelection(planOf({ isCustom: true }), selectionOf(), NEW_CUSTOMER)).toThrow(
            expect.objectContaining({ code: BillingErrorCode.PlanCustom }),
        )
    })
    it("refuses a changed allowance on an individual plan", async () => {
        const { subject } = await buildSubject()

        expect(() => subject.quoteSelection(planOf(), selectionOf({ tierCredits: 100 }), NEW_CUSTOMER)).toThrow(
            expect.objectContaining({ code: BillingErrorCode.TierUnknown }),
        )
    })
})

describe("pricing policy > quoteSelection", () => {
    it("requires a credit tier for a per-seat plan", async () => {
        const { subject } = await buildSubject()

        expect(() => subject.quoteSelection(planOf({ perSeat: true }), selectionOf(), NEW_CUSTOMER)).toThrow(
            expect.objectContaining({ code: BillingErrorCode.TierRequired }),
        )
    })
    it("refuses a tier absent from the per-seat catalogue", async () => {
        const { subject } = await buildSubject()

        expect(() =>
            subject.quoteSelection(planOf({ perSeat: true }), selectionOf({ tierCredits: 999 }), NEW_CUSTOMER),
        ).toThrow(expect.objectContaining({ code: BillingErrorCode.TierUnknown }))
    })
    it.each([0.5, 0, -1, 4])("refuses invalid paid seats %p and reports the plan maximum", async (seats) => {
        const { subject } = await buildSubject()

        expect(() =>
            subject.quoteSelection(planOf({ perSeat: true }), selectionOf({ tierCredits: 500, seats }), NEW_CUSTOMER),
        ).toThrow(expect.objectContaining({ code: BillingErrorCode.SeatsInvalid, params: { max: 3 } }))
    })
})

describe("pricing policy > quoteSelection", () => {
    it.each([{ priceAnnualVnd: null }, { annualDiscountPct: null }])(
        "refuses an annual cycle missing catalogue terms %p",
        async (changes) => {
            const { subject } = await buildSubject()

            expect(() =>
                subject.quoteSelection(planOf(changes), selectionOf({ cycle: "annual" }), NEW_CUSTOMER),
            ).toThrow(expect.objectContaining({ code: BillingErrorCode.CycleUnavailable }))
        },
    )
})

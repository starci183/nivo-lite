import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { JobRecord, OfferTerms, TextOf } from "../hiring.contracts"
import {
    cleanLetterPart as cleanLetterPartImplementation,
    composeOffer as composeOfferImplementation,
    payPhrase as payPhraseImplementation,
    termsBlock as termsBlockImplementation,
} from "./offer-letter.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    cleanLetterPart: typeof cleanLetterPartImplementation
    composeOffer: typeof composeOfferImplementation
    payPhrase: typeof payPhraseImplementation
    termsBlock: typeof termsBlockImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cleanLetterPart: cleanLetterPartImplementation,
                    composeOffer: composeOfferImplementation,
                    payPhrase: payPhraseImplementation,
                    termsBlock: termsBlockImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const text = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
    `${key}${JSON.stringify(params)}`

const build = () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const textOf: TextOf = (key, params) => catalog.get(key, params, "vi")
    const formatter = mock<{ format(amount: number): string }>()
    formatter.format.mockImplementation((amount) => `VND ${amount}`)
    return { catalog, textOf, format: formatter.format }
}

const jobOf = builder<JobRecord>({
    id: "job-1",
    workspaceId: "workspace-1",
    slug: "cashier",
    title: "Cashier",
    position: "Cashier",
    employmentType: "part_time",
    schedule: "Evenings",
    payMinVnd: 30000,
    payMaxVnd: 50000,
    payUnit: "hour",
    location: "Main shop",
    headcount: 1,
    description: "Serve customers",
    requirements: {
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
    status: "open",
    channels: ["page"],
    closesAt: null,
})

const termsOf = builder<OfferTerms>({ title: "", pay: "", startDate: "", probation: "", note: "" })

describe("offer letter policy", () => {
    describe("payPhrase", () => {
        it("quotes equal positive amounts as exact pay", async () => {
            const subject = await buildSubject()

            const { catalog, textOf, format } = build()

            expect(subject.payPhrase(jobOf({ payMinVnd: 30000, payMaxVnd: 30000 }), textOf, format)).toBe(
                text("hiring.pay.exact", { amount: "VND 30000", unit: "hiring.payUnit.hour{}" }),
            )
            expect(catalog.get.mock.calls).toEqual([
                ["hiring.payUnit.hour", {}, "vi"],
                ["hiring.pay.exact", { amount: "VND 30000", unit: "hiring.payUnit.hour{}" }, "vi"],
            ])
        })

        it("quotes different positive amounts as a range", async () => {
            const subject = await buildSubject()

            const { textOf, format } = build()

            expect(subject.payPhrase(jobOf({ payUnit: "month" }), textOf, format)).toBe(
                text("hiring.pay.range", {
                    min: "VND 30000",
                    max: "VND 50000",
                    unit: "hiring.payUnit.month{}",
                }),
            )
        })

        it.each([null, 0, -1])("quotes only a positive lower amount when the upper amount is %s", async (max) => {
            const subject = await buildSubject()

            const { textOf, format } = build()

            expect(
                subject.payPhrase(jobOf({ payMinVnd: 30000, payMaxVnd: max, payUnit: "shift" }), textOf, format),
            ).toBe(text("hiring.pay.from", { amount: "VND 30000", unit: "hiring.payUnit.shift{}" }))
        })

        it.each([null, 0, -1])("quotes only a positive upper amount when the lower amount is %s", async (min) => {
            const subject = await buildSubject()

            const { textOf, format } = build()

            expect(subject.payPhrase(jobOf({ payMinVnd: min, payMaxVnd: 50000 }), textOf, format)).toBe(
                text("hiring.pay.upTo", { amount: "VND 50000", unit: "hiring.payUnit.hour{}" }),
            )
        })

        it.each([
            [null, null],
            [null, 0],
            [0, null],
            [0, 0],
            [-1, -2],
        ])("makes nonpositive or absent amounts negotiable (%s, %s)", async (min, max) => {
            const subject = await buildSubject()

            const { textOf, format } = build()

            expect(subject.payPhrase(jobOf({ payMinVnd: min, payMaxVnd: max }), textOf, format)).toBe(
                "hiring.pay.negotiable{}",
            )
        })
    })
})

describe("offer letter policy", () => {
    describe("termsBlock", () => {
        it("uses the job title and computed pay when the entered terms are empty", async () => {
            const subject = await buildSubject()

            const { textOf } = build()

            expect(subject.termsBlock(jobOf({ location: "" }), termsOf(), 7, "Computed pay", textOf)).toBe(
                [
                    "hiring.offer.termsHead{}",
                    text("hiring.offer.termPosition", {
                        title: "Cashier",
                        employment: "hiring.employment.part_time{}",
                    }),
                    text("hiring.offer.termPay", { pay: "Computed pay" }),
                    text("hiring.offer.termValid", { days: 7 }),
                ].join("\n"),
            )
        })

        it("preserves every owner-entered term and the job location in order", async () => {
            const subject = await buildSubject()

            const { textOf } = build()
            const terms = termsOf({
                title: "Senior cashier",
                pay: "Agreed hourly pay",
                startDate: "2026-11-01",
                probation: "One month",
                note: "Bring your documents",
            })

            expect(subject.termsBlock(jobOf({ employmentType: "full_time" }), terms, 5, "Computed pay", textOf)).toBe(
                [
                    "hiring.offer.termsHead{}",
                    text("hiring.offer.termPosition", {
                        title: "Senior cashier",
                        employment: "hiring.employment.full_time{}",
                    }),
                    text("hiring.offer.termPay", { pay: "Agreed hourly pay" }),
                    text("hiring.offer.termStart", { date: "2026-11-01" }),
                    text("hiring.offer.termProbation", { probation: "One month" }),
                    text("hiring.offer.termPlace", { place: "Main shop" }),
                    text("hiring.offer.termNote", { note: "Bring your documents" }),
                    text("hiring.offer.termValid", { days: 5 }),
                ].join("\n"),
            )
        })
    })
})

describe("offer letter policy", () => {
    describe("composeOffer", () => {
        it("uses catalog opening and closing for null model paragraphs", async () => {
            const subject = await buildSubject()

            const { textOf } = build()

            expect(
                subject.composeOffer(
                    {
                        candidate: "Alex",
                        shop: "Main shop",
                        title: "Cashier",
                        terms: "Approved terms",
                        opening: null,
                        closing: null,
                    },
                    textOf,
                ),
            ).toBe(
                [
                    text("hiring.offer.opening", { name: "Alex", shop: "Main shop", title: "Cashier" }),
                    "Approved terms",
                    "hiring.offer.closing{}",
                    text("hiring.offer.signoff", { shop: "Main shop" }),
                ].join("\n\n"),
            )
        })

        it("places supplied model paragraphs around the exact approved terms", async () => {
            const subject = await buildSubject()

            const { catalog, textOf } = build()

            expect(
                subject.composeOffer(
                    {
                        candidate: "Alex",
                        shop: "Main shop",
                        title: "Cashier",
                        terms: "Approved terms",
                        opening: "Model opening",
                        closing: "Model closing",
                    },
                    textOf,
                ),
            ).toBe(`Model opening\n\nApproved terms\n\nModel closing\n\nhiring.offer.signoff{"shop":"Main shop"}`)
            expect(catalog.get.mock.calls).toEqual([["hiring.offer.signoff", { shop: "Main shop" }, "vi"]])
        })

        it("preserves empty strings because only null chooses a template", async () => {
            const subject = await buildSubject()

            const { textOf } = build()

            expect(
                subject.composeOffer(
                    {
                        candidate: "Alex",
                        shop: "Main shop",
                        title: "Cashier",
                        terms: "Approved terms",
                        opening: "",
                        closing: "",
                    },
                    textOf,
                ),
            ).toBe(`\n\nApproved terms\n\n\n\nhiring.offer.signoff{"shop":"Main shop"}`)
        })
    })
})

describe("offer letter policy", () => {
    describe("cleanLetterPart", () => {
        it("strips heading and emphasis markup and surrounding whitespace", async () => {
            const subject = await buildSubject()

            expect(subject.cleanLetterPart("  ## **Welcome aboard** __We value your work__.  ")).toBe(
                "Welcome aboard We value your work.",
            )
            expect(subject.cleanLetterPart("*Welcome aboard.*")).toBe("Welcome aboard.")
        })

        it("accepts the exact minimum and maximum paragraph lengths", async () => {
            const subject = await buildSubject()

            expect(subject.cleanLetterPart("Welcome aboard.")).toBe("Welcome aboard.")
            expect(subject.cleanLetterPart("a".repeat(700))).toBe("a".repeat(700))
        })

        it("rejects paragraphs outside the permitted length", async () => {
            const subject = await buildSubject()

            expect(subject.cleanLetterPart("Welcome aboard")).toBeNull()
            expect(subject.cleanLetterPart("a".repeat(701))).toBeNull()
            expect(subject.cleanLetterPart("   ")).toBeNull()
        })

        it("rejects figures and paragraphs containing protected criteria", async () => {
            const subject = await buildSubject()

            expect(subject.cleanLetterPart("Welcome aboard in 2026.")).toBeNull()
            expect(subject.cleanLetterPart("We require tre trung applicants.")).toBeNull()
        })
    })
})

describe("letter markup boundaries", () => {
    it("retains literal hash runs and removes only headings followed by a space", async () => {
        const subject = await buildSubject()
        expect(subject.cleanLetterPart("Welcome ###aboard today.")).toBe("Welcome ###aboard today.")
        expect(subject.cleanLetterPart("Welcome ### aboard today.")).toBe("Welcome aboard today.")
        expect(subject.cleanLetterPart(`${"#".repeat(20000)} Welcome aboard.`)).toBe("Welcome aboard.")
        expect(subject.cleanLetterPart("Welcome ###**aboard** today.")).toBe("Welcome ###aboard today.")
    })
})

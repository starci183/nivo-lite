import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { valueRules } from "./values.policy"

const SUBJECT = Symbol("values.policy")
type Subject = { valueRules: typeof valueRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { valueRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factOf = builder<ReviewFact>({
    id: "f1",
    subjectKey: "cong-ty-tnhh-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "dia-chi",
    attributeLabel: "Dia chi",
    value: "So 1",
    valueNumber: null,
    unit: null,
    status: "proposed",
    validFrom: null,
    validTo: null,
    conflictWith: null,
    sourceIds: ["s1"],
    quotes: [],
    updatedAt: "2026-01-10T00:00:00.000Z",
})

const docOf = builder<DocumentInput>({
    id: "s1",
    title: "Hop dong",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-08-01",
    updatedAt: "2026-08-01T00:00:00.000Z",
    chunkCount: 1,
    passages: [],
})

const contextOf = (docs: ReadonlyArray<DocumentInput>, facts: ReadonlyArray<ReviewFact>): ReviewContext => ({
    today: "2026-10-31",
    dossiers: [
        {
            dossier: {
                id: "d25",
                ref: "25",
                name: "Quy che luong",
                category: "STAFF",
                position: 25,
                checklistStatus: "present",
                existing: null,
                missing: null,
                drafts: null,
            },
            entry: null,
            documents: docs,
            facts,
        } satisfies DossierInputs,
    ],
    activeFacts: [],
})

const wageOf = (id: string, value: string, extra: Partial<ReviewFact> = {}) =>
    factOf({ id, attribute: "muc-luong", attributeLabel: "Muc luong", value, ...extra })

describe("valueRules values.minimum_wage", () => {
    it("finds a wage below the regional minimum of its date, from its validity, its document or today", async () => {
        const subject = await buildSubject()
        const context = contextOf(
            [docOf(), docOf({ id: "s2", date: null })],
            [
                wageOf("w1", "4.000.000", { validFrom: "2026-02-01" }),
                wageOf("w2", "3.900.000"),
                wageOf("w3", "3.800.000", { sourceIds: ["s2"] }),
                wageOf("w4", "5.000.000"),
                wageOf("w5", "5"),
                wageOf("w6", "none"),
                wageOf("w7", "3.000.000", { validFrom: "2025-06-01" }),
                wageOf("w8", "3.000.000", { sourceIds: ["gone"] }),
                factOf({ id: "x1", value: "1.000.000" }),
            ],
        )

        const found = subject.valueRules(context)

        expect(found.map((item) => item.params)).toEqual([
            { amount: "4.000.000", minimum: "4.140.000", region: "III" },
            { amount: "3.900.000", minimum: "4.140.000", region: "III" },
            { amount: "3.800.000", minimum: "4.140.000", region: "III" },
        ])
        expect(found[0]).toEqual(
            expect.objectContaining({
                ruleKey: "values.minimum_wage",
                dossierId: "d25",
                subject: "cong-ty-tnhh-mau|muc-luong",
                kind: "unreasonable",
                severity: "medium",
                code: "values_minimum_wage",
                remedyAction: "decide",
            }),
        )
    })
})

describe("valueRules values.dates", () => {
    it("finds an end before its start and a document dated after tomorrow", async () => {
        const subject = await buildSubject()
        const context = contextOf(
            [docOf({ id: "s1", date: "2026-11-05" }), docOf({ id: "s2", date: "2026-11-01" })],
            [
                factOf({ id: "r1", validFrom: "2026-05-01", validTo: "2026-04-01" }),
                factOf({ id: "r2", validFrom: "2026-05-01", validTo: "2026-06-01" }),
                factOf({ id: "r3", validFrom: "2026-05-01" }),
                factOf({ id: "r4", validTo: "2026-04-01" }),
                factOf({ id: "r5", validFrom: "2026-05-01", validTo: "2026-04-01", sourceIds: ["gone"] }),
            ],
        )

        expect(subject.valueRules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "values.dates",
                subject: "order:r1",
                severity: "low",
                code: "values_dates_order",
                params: { subject: "Cong ty TNHH Mau", from: "01/05/2026", to: "01/04/2026" },
            }),
            expect.objectContaining({
                ruleKey: "values.dates",
                subject: "future:s1",
                code: "values_dates_future",
                params: { document: "Hop dong", date: "05/11/2026" },
            }),
        ])
    })

    it("ignores undated and template documents", async () => {
        const subject = await buildSubject()
        const context = contextOf(
            [docOf({ date: null }), docOf({ id: "s2", state: "template", date: "2027-01-01" })],
            [],
        )

        expect(subject.valueRules(context)).toEqual([])
    })
})

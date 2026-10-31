import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { identifierRules } from "./identifiers.policy"

const SUBJECT = Symbol("identifiers.policy")
type Subject = { identifierRules: typeof identifierRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { identifierRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factOf = builder<ReviewFact>({
    id: "a1",
    subjectKey: "cong-ty-tnhh-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "ma-so-thue",
    attributeLabel: "MST",
    value: "0123456789",
    valueNumber: null,
    unit: null,
    status: "active",
    validFrom: null,
    validTo: null,
    conflictWith: null,
    sourceIds: [],
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

const contextOf = (doc: DocumentInput, activeFacts: ReadonlyArray<ReviewFact>): ReviewContext => ({
    today: "2026-10-31",
    dossiers: [
        {
            dossier: {
                id: "d35",
                ref: "35",
                name: "Hop dong mua vao",
                category: "CONTRACTS",
                position: 35,
                checklistStatus: "present",
                existing: null,
                missing: null,
                drafts: null,
            },
            entry: null,
            documents: [doc],
            facts: [],
        },
    ],
    activeFacts,
})

const passage = (id: string, text: string) => ({ id, order: 0, text })
const TAX = factOf()
const CITIZEN = factOf({ id: "a2", attribute: "so-cccd", attributeLabel: "So CCCD", value: "001234567890" })
/** "Ma so thue 0999999999" with its Vietnamese marks. */
const STRANGE_TAX = "M\u00e3 s\u1ed1 thu\u1ebf 0999999999"
/** "can cuoc 009876543210" with its Vietnamese marks. */
const STRANGE_ID = "c\u0103n c\u01b0\u1edbc 009876543210"

describe("identifierRules", () => {
    it("finds tax codes and citizen numbers that differ from every active value, one finding per kind and dossier", async () => {
        const subject = await buildSubject()
        const doc = docOf({
            passages: [
                passage("p1", `MST: 0123456789-001 va ${STRANGE_TAX}`),
                passage("p2", `CCCD s\u1ed1: 001234567890; ${STRANGE_ID}`),
            ],
        })

        const found = subject.identifierRules(contextOf(doc, [TAX, CITIZEN]))

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "identifiers.canonical",
                dossierId: "d35",
                kind: "contradiction",
                severity: "medium",
                code: "identifiers_tax",
                subject: "tax:0999999999",
                params: { count: "1", numbers: "0999999999" },
                remedyAction: "decide",
            }),
            expect.objectContaining({
                code: "identifiers_id",
                subject: "id:009876543210",
                params: { count: "1", numbers: "009876543210" },
            }),
        ])
        expect(found[0]?.evidence.map((item) => [item.role, item.passageId, item.factId, item.quote])).toEqual([
            ["claim", "p1", null, STRANGE_TAX],
            ["counter", null, "a1", "0123456789"],
        ])
        expect(found[1]?.evidence.map((item) => item.quote)).toEqual([STRANGE_ID, "001234567890"])
    })

    it("finds nothing without an active value to compare with, or when every number is known", async () => {
        const subject = await buildSubject()
        const doc = docOf({ passages: [passage("p1", "MST 0123456789, CCCD 001234567890, MST 0999999999")] })
        const known = docOf({ passages: [passage("p1", "MST 0123456789, CCCD 001234567890")] })

        expect(subject.identifierRules(contextOf(doc, []))).toEqual([])
        expect(subject.identifierRules(contextOf(known, [TAX, CITIZEN]))).toEqual([])
    })
})

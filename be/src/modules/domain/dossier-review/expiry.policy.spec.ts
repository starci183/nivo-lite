import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, DossierRef, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import { expiryOf, expiryRules } from "./expiry.policy"

const SUBJECT = Symbol("expiry.policy")
type Subject = { expiryOf: typeof expiryOf; expiryRules: typeof expiryRules }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { expiryOf, expiryRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const dossierOf = builder<DossierRef>({
    id: "d4",
    ref: "4",
    name: "Chu ky so",
    category: "PHAP LY",
    position: 4,
    checklistStatus: "present",
    existing: null,
    missing: null,
    drafts: null,
})
const docOf = builder<DocumentInput>({
    id: "s4",
    title: "04. So theo doi chung thu",
    tags: [],
    origin: null,
    state: "actual",
    date: null,
    updatedAt: "2026-10-01T00:00:00.000Z",
    chunkCount: 0,
    passages: [],
})
const factOf = builder<ReviewFact>({
    id: "f1",
    subjectKey: "chung-thu-so",
    subject: "Chung thu so",
    attribute: "ngay-het-han",
    attributeLabel: "Ngay het han",
    value: "14/07/2028",
    valueNumber: null,
    unit: null,
    status: "proposed",
    validFrom: null,
    validTo: null,
    conflictWith: null,
    sourceIds: ["s4"],
    quotes: [],
    updatedAt: "2026-10-01T00:00:00.000Z",
})
const tracked = builder<DossierInputs>({
    dossier: dossierOf(),
    entry: PACK.get("4") ?? null,
    documents: [docOf()],
    facts: [],
})
const contextOf = builder<ReviewContext>({ today: "2026-10-31", dossiers: [], activeFacts: [] })

describe("expiryOf", () => {
    it("reads an expiry attribute's date, else its end; an end of another fact only where expiry is tracked", async () => {
        const subject = await buildSubject()
        expect(subject.expiryOf(factOf(), false)).toBe("2028-07-14")
        expect(subject.expiryOf(factOf({ value: "khong ro", validTo: "2027-01-01" }), false)).toBe("2027-01-01")
        expect(subject.expiryOf(factOf({ value: "khong ro" }), false)).toBeNull()
        const other = factOf({ attribute: "nha-cung-cap", validTo: "2026-12-01" })
        expect(subject.expiryOf(other, true)).toBe("2026-12-01")
        expect(subject.expiryOf(other, false)).toBeNull()
    })
})

describe("expiry.dates", () => {
    it("files a passed expiry as high and one within 60 days as medium, nothing further off or outside the pass", async () => {
        const subject = await buildSubject()
        const passed = factOf({ id: "f1", subjectKey: "chung-thu-a", subject: "Chung thu A", value: "20/10/2026" })
        const soon = factOf({ id: "f2", subjectKey: "chung-thu-b", subject: "Chung thu B", value: "15/12/2026" })
        const far = factOf({ id: "f3" })
        const outside = factOf({ id: "f4", value: "01/01/2026", sourceIds: ["sx"] })
        const domain = factOf({ id: "f5", attribute: "nha-dang-ky", validTo: "2026-11-01", sourceIds: ["s53"] })
        const untrackedDossier = builder<DossierInputs>({
            dossier: dossierOf({ id: "d9", ref: "9", name: "Danh sach" }),
            entry: null,
            documents: [docOf({ id: "s53" })],
            facts: [domain],
        })()
        const context = contextOf({ dossiers: [tracked({ facts: [passed, soon, far, outside] }), untrackedDossier] })

        expect(subject.expiryRules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "expiry.dates",
                dossierId: "d4",
                kind: "expired",
                severity: "high",
                code: "expiry_expired",
                params: { dossier: "4. Chu ky so", item: "Chung thu A", date: "20/10/2026", state: "expired" },
                evidence: [expect.objectContaining({ role: "claim", factId: "f1", sourceId: "s4" })],
                remedyAction: "external",
                subject: "chung-thu-a|ngay-het-han",
            }),
            expect.objectContaining({
                severity: "medium",
                code: "expiry_expiring",
                params: { dossier: "4. Chu ky so", item: "Chung thu B", date: "15/12/2026", state: "expiring" },
                subject: "chung-thu-b|ngay-het-han",
            }),
        ])
    })
})

describe("expiry.untracked", () => {
    it("files a dossier that tracks expiry and records none", async () => {
        const subject = await buildSubject()
        expect(subject.expiryRules(contextOf({ dossiers: [tracked()] }))).toEqual([
            expect.objectContaining({
                ruleKey: "expiry.untracked",
                kind: "missing",
                severity: "low",
                code: "expiry_untracked",
                params: { dossier: "4. Chu ky so" },
                evidence: [
                    expect.objectContaining({ role: "expected", label: "Chu ky so" }),
                    expect.objectContaining({ role: "context", sourceId: "s4", label: "04. So theo doi chung thu" }),
                ],
                remedyAction: "upload",
                subject: "untracked",
            }),
        ])
    })

    it("files nothing with an expiry recorded, without documents, or where expiry is not tracked", async () => {
        const subject = await buildSubject()
        const context = contextOf({
            dossiers: [
                tracked({ facts: [factOf()] }),
                tracked({ dossier: dossierOf({ id: "d5" }), documents: [] }),
                tracked({ dossier: dossierOf({ id: "d6" }), entry: PACK.get("2") ?? null }),
            ],
        })
        expect(subject.expiryRules(context)).toEqual([])
    })
})

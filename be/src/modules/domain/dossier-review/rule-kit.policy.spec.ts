import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, DossierRef, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import {
    amountOf,
    candidateOf,
    dateOfFact,
    datesOf,
    digitsOf,
    displayAmount,
    displayDate,
    documentEvidence,
    documentsIn,
    dossierLabel,
    dossierOfFact,
    dossierOfSources,
    expectedEvidence,
    factEvidence,
    factsOfContext,
    hasAnyWord,
    hasWord,
    isAttribute,
    passageEvidence,
    quoteAround,
    remedyActionOf,
    titlesOf,
} from "./rule-kit.policy"

const SUBJECT = Symbol("rule-kit.policy")
const KIT = {
    amountOf,
    candidateOf,
    dateOfFact,
    datesOf,
    digitsOf,
    displayAmount,
    displayDate,
    documentEvidence,
    documentsIn,
    dossierLabel,
    dossierOfFact,
    dossierOfSources,
    expectedEvidence,
    factEvidence,
    factsOfContext,
    hasAnyWord,
    hasWord,
    isAttribute,
    passageEvidence,
    quoteAround,
    remedyActionOf,
    titlesOf,
}
type Subject = typeof KIT
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    amountOf,
                    candidateOf,
                    dateOfFact,
                    datesOf,
                    digitsOf,
                    displayAmount,
                    displayDate,
                    documentEvidence,
                    documentsIn,
                    dossierLabel,
                    dossierOfFact,
                    dossierOfSources,
                    expectedEvidence,
                    factEvidence,
                    factsOfContext,
                    hasAnyWord,
                    hasWord,
                    isAttribute,
                    passageEvidence,
                    quoteAround,
                    remedyActionOf,
                    titlesOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const dossierOf = builder<DossierRef>({
    id: "d1",
    ref: "1",
    name: "Giay chung nhan",
    category: "PHAP LY",
    position: 1,
    checklistStatus: "present",
    existing: null,
    missing: null,
    drafts: null,
})
const docOf = builder<DocumentInput>({
    id: "s1",
    title: "01. Giay chung nhan",
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
    subjectKey: "cong-ty-tnhh-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "von-dieu-le",
    attributeLabel: "Von dieu le",
    value: "300.000.000",
    valueNumber: null,
    unit: null,
    status: "proposed",
    validFrom: null,
    validTo: null,
    conflictWith: null,
    sourceIds: ["s1"],
    quotes: [],
    updatedAt: "2026-10-01T00:00:00.000Z",
})
const inputsOf = builder<DossierInputs>({ dossier: dossierOf(), entry: null, documents: [], facts: [] })
const contextOf = builder<ReviewContext>({ today: "2026-10-31", dossiers: [], activeFacts: [] })

const EMPTY = {
    sourceId: null,
    sourceTitle: null,
    passageId: null,
    factId: null,
    factLine: null,
    quote: null,
} as const

describe("rule-kit words and values", () => {
    it("finds whole words only, past an occurrence inside another word", async () => {
        const subject = await buildSubject()
        expect(subject.hasWord("bien ban hop", "ban")).toBe(true)
        expect(subject.hasWord("banh ban", "ban")).toBe(true)
        expect(subject.hasWord("banh", "ban")).toBe(false)
        expect(subject.hasAnyWord("dieu le cong ty", ["con dau", "dieu le"])).toBe(true)
        expect(subject.hasAnyWord("dieu le", [])).toBe(false)
    })

    it("reads amounts from the number, grouped digits, decimals and the million and billion words", async () => {
        const subject = await buildSubject()
        expect(subject.amountOf(factOf({ valueNumber: 5 }))).toBe(5)
        expect(subject.amountOf(factOf({ value: "khong ro" }))).toBeNull()
        expect(subject.amountOf(factOf())).toBe(300_000_000)
        expect(subject.amountOf(factOf({ value: "182 trieu" }))).toBe(182_000_000)
        expect(subject.amountOf(factOf({ value: "1,5 ty dong" }))).toBe(1_500_000_000)
        expect(subject.amountOf(factOf({ value: "64%" }))).toBe(64)
    })

    it("reads digits, dates and attributes of facts", async () => {
        const subject = await buildSubject()
        expect(subject.digitsOf("MST: 0101-234")).toBe("0101234")
        expect(subject.dateOfFact(factOf({ value: "17/08/2026" }))).toBe("2026-08-17")
        expect(subject.dateOfFact(factOf({ value: "x", validFrom: "2026-01-09" }))).toBe("2026-01-09")
        expect(subject.isAttribute(factOf(), ["von-dieu-le"])).toBe(true)
        expect(subject.isAttribute(factOf(), ["mst"])).toBe(false)
    })

    it("writes dates and amounts as the documents do", async () => {
        const subject = await buildSubject()
        expect(subject.displayDate("2026-08-17")).toBe("17/08/2026")
        expect(subject.displayAmount(182_000_000)).toBe("182.000.000")
        expect(subject.quoteAround("abcdefghij", 4, 6, 2)).toBe("cdefgh")
        expect(subject.quoteAround(" abc ", 0, 5, 9)).toBe("abc")
    })
})

describe("rule-kit pass lookups", () => {
    const first = inputsOf({
        documents: [docOf({ date: "2026-01-09" })],
        facts: [factOf(), factOf({ id: "f2" })],
    })
    const second = inputsOf({
        dossier: dossierOf({ id: "d2", ref: "2", name: "Dieu le" }),
        documents: [docOf({ id: "s2", title: "02. Dieu le" })],
        facts: [factOf({ id: "f2" }), factOf({ id: "f3", sourceIds: ["s2"] })],
    })
    const context = contextOf({ dossiers: [first, second] })

    it("maps the documents of a pass to their titles, dossiers and dates, and lists each fact once", async () => {
        const subject = await buildSubject()
        expect(subject.dossierLabel(second)).toBe("2. Dieu le")
        expect([...subject.titlesOf(context)]).toEqual([
            ["s1", "01. Giay chung nhan"],
            ["s2", "02. Dieu le"],
        ])
        expect(subject.dossierOfSources(context).get("s2")).toBe(second)
        expect(subject.datesOf(context).get("s1")).toBe("2026-01-09")
        expect(subject.factsOfContext(context).map((fact) => fact.id)).toEqual(["f1", "f2", "f3"])
    })

    it("files a fact under the dossier of its first document in the pass", async () => {
        const subject = await buildSubject()
        const owners = subject.dossierOfSources(context)
        expect(subject.dossierOfFact(factOf({ sourceIds: ["sx", "s2"] }), owners)).toBe(second)
        expect(subject.dossierOfFact(factOf({ sourceIds: ["sx"] }), owners)).toBeUndefined()
    })

    it("picks the documents of a dossier in the given states", async () => {
        const subject = await buildSubject()
        const draft = docOf({ id: "s3", state: "draft" })
        const inputs = inputsOf({ documents: [docOf(), draft, docOf({ id: "s4", state: "template" })] })
        expect(subject.documentsIn(inputs, ["draft"])).toEqual([draft])
    })
})

describe("rule-kit evidence", () => {
    it("quotes a fact's value with the first of its documents that has a title", async () => {
        const subject = await buildSubject()
        const titles = new Map([["s2", "02. Dieu le"]])
        expect(subject.factEvidence(factOf({ sourceIds: ["s1", "s2"] }), "claim", titles)).toEqual({
            role: "claim",
            label: "Von dieu le",
            sourceId: "s2",
            sourceTitle: "02. Dieu le",
            passageId: null,
            factId: "f1",
            factLine: "Cong ty TNHH Mau - Von dieu le: 300.000.000",
            quote: "300.000.000",
        })
        expect(subject.factEvidence(factOf(), "counter", titles)).toEqual(
            expect.objectContaining({ role: "counter", sourceId: null, sourceTitle: null }),
        )
    })

    it("cites a document, a passage or nothing", async () => {
        const subject = await buildSubject()
        const doc = docOf()
        expect(subject.documentEvidence(doc, "claim", "L")).toEqual({
            ...EMPTY,
            role: "claim",
            label: "L",
            sourceId: "s1",
            sourceTitle: "01. Giay chung nhan",
        })
        expect(subject.passageEvidence(doc, { id: "p1", order: 0, text: "abc" }, "abc", "context", "L")).toEqual({
            ...EMPTY,
            role: "context",
            label: "L",
            sourceId: "s1",
            sourceTitle: "01. Giay chung nhan",
            passageId: "p1",
            quote: "abc",
        })
        expect(subject.expectedEvidence("CCCD")).toEqual({ ...EMPTY, role: "expected", label: "CCCD" })
    })
})

describe("rule-kit candidates", () => {
    const shape = {
        ruleKey: "presence.expected",
        subject: "charter",
        kind: "missing",
        severity: "high",
        code: "presence_expected",
        params: { dossier: "2. Dieu le" },
        evidence: Array.from(
            { length: 9 },
            (_, index) => ({ ...EMPTY, role: "expected", label: `E${index}` }) as const,
        ),
        remedyAction: "draft",
    } as const

    it("files a draftable rule finding with the pack's document type, related dossiers sorted and without itself", async () => {
        const subject = await buildSubject()
        const charter = inputsOf({ dossier: dossierOf({ id: "d2", ref: "2" }), entry: PACK.get("2") ?? null })
        const related = [inputsOf({ dossier: dossierOf({ id: "d9" }) }), inputsOf(), charter, inputsOf()]
        expect(subject.candidateOf(charter, { ...shape, related })).toEqual({
            ruleKey: "presence.expected",
            dossierId: "d2",
            relatedDossierIds: ["d1", "d9"],
            kind: "missing",
            severity: "high",
            origin: "rule",
            code: "presence_expected",
            params: { dossier: "2. Dieu le" },
            title: "",
            detail: "",
            evidence: shape.evidence.slice(0, 8),
            remedyAction: "draft",
            remedyDocumentType: PACK.get("2")?.remedy?.documentType,
            subject: "charter",
        })
    })

    it("names no document type without a pack remedy or for another remedy", async () => {
        const subject = await buildSubject()
        expect(subject.candidateOf(inputsOf(), shape)).toEqual(
            expect.objectContaining({ relatedDossierIds: [], remedyDocumentType: null }),
        )
        const charter = inputsOf({ entry: PACK.get("2") ?? null })
        expect(subject.candidateOf(charter, { ...shape, remedyAction: "decide" }).remedyDocumentType).toBeNull()
    })

    it("takes the remedy of the pack entry, else the fallback", async () => {
        const subject = await buildSubject()
        expect(subject.remedyActionOf(inputsOf({ entry: PACK.get("5") ?? null }), "decide")).toBe("external")
        expect(subject.remedyActionOf(inputsOf({ entry: PACK.get("4") ?? null }), "decide")).toBe("decide")
        expect(subject.remedyActionOf(inputsOf(), "upload")).toBe("upload")
    })
})

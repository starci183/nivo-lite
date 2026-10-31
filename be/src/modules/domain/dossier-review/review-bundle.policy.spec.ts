import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, DossierRef, PassageInput, ReviewFact } from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import type { ReasonedFinding, ReasonedReview } from "./dossier-review.port"
import type { EvidenceCorpus } from "./evidence.policy"
import {
    buildBundle,
    citedEvidence,
    corpusOf,
    factText,
    inputsFingerprintOf,
    reasonedCandidates,
    resolvedByModel,
} from "./review-bundle.policy"
import type { BundleInput, BundleKeys, BuiltBundle } from "./review-bundle.policy"

const SUBJECT = Symbol("review-bundle.policy")
type Subject = {
    buildBundle: typeof buildBundle
    citedEvidence: typeof citedEvidence
    corpusOf: typeof corpusOf
    factText: typeof factText
    inputsFingerprintOf: typeof inputsFingerprintOf
    reasonedCandidates: typeof reasonedCandidates
    resolvedByModel: typeof resolvedByModel
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    buildBundle,
                    citedEvidence,
                    corpusOf,
                    factText,
                    inputsFingerprintOf,
                    reasonedCandidates,
                    resolvedByModel,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const passageOf = builder<PassageInput>({ id: "p1", order: 0, text: "Charter capital is 300.000.000 VND" })
const documentOf = builder<DocumentInput>({
    id: "s1",
    title: "02. Charter",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-01-09",
    updatedAt: "2026-01-10T00:00:00.000Z",
    chunkCount: 1,
    passages: [passageOf()],
})
const factOf = builder<ReviewFact>({
    id: "f1",
    subjectKey: "cong-ty-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "von-dieu-le",
    attributeLabel: "Charter capital",
    value: "300.000.000",
    valueNumber: 300_000_000,
    unit: "VND",
    status: "proposed",
    validFrom: "2026-01-09",
    validTo: null,
    conflictWith: null,
    sourceIds: ["s1"],
    quotes: ["capital is 300.000.000"],
    updatedAt: "2026-01-10T00:00:00.000Z",
})
const dossierOf = builder<DossierRef>({
    id: "d2",
    ref: "2",
    name: "Charter",
    category: "LEGAL FILES",
    position: 2,
    checklistStatus: "partial",
    existing: "Charter",
    missing: "Amended charter",
    drafts: "Resolution",
})
const BARE = { existing: null, missing: null, drafts: null }
const inputsOf = builder<DossierInputs>({
    dossier: dossierOf(),
    entry: PACK.get("2") ?? null,
    documents: [documentOf()],
    facts: [factOf()],
})
const REGISTER = documentOf({
    id: "s8",
    title: "08. Register",
    passages: [passageOf({ id: "p8", text: "Member A holds 64%" })],
})
const RELATED_FACT = factOf({
    id: "f8",
    value: "285.000.000",
    valueNumber: 285_000_000,
    sourceIds: ["s8"],
    unit: null,
    validFrom: null,
})
const relatedOf = (): DossierInputs =>
    inputsOf({
        dossier: dossierOf({ id: "d8", ref: "8", name: "Members register", category: "MEMBERS", position: 8, ...BARE }),
        entry: null,
        documents: [REGISTER],
        facts: [RELATED_FACT],
    })
const inputOf = builder<BundleInput>({
    workspaceId: "w1",
    today: "2026-10-31",
    inputs: inputsOf(),
    related: [relatedOf()],
    known: [{ kind: "missing", title: "Lacks the signed charter" }],
    openAi: [{ fingerprint: "fpA", title: "Charter names a former member", detail: "Article 5" }],
})

const findingOf = builder<ReasonedFinding>({
    kind: "contradiction",
    severity: "high",
    title: "Capital differs",
    detail: "The register says otherwise",
    evidence: [
        { key: "S1.P1", quote: "300.000.000" },
        { key: "F2", quote: "285.000.000" },
    ],
    relatedRefs: ["8", "99", "8"],
    remedyAction: "decide",
    documentType: null,
})
const reviewOf = builder<ReasonedReview>({
    findings: [findingOf()],
    stillOpen: [],
    model: "m",
    promptTokens: 10,
    completionTokens: 2,
})

describe("factText", () => {
    it("writes the subject, attribute, value, unit, status, start and the citing document", async () => {
        const subject = await subjectOf()
        expect(subject.factText(factOf(), "S1")).toBe(
            "Cong ty TNHH Mau | Charter capital = 300.000.000 VND (proposed, from 2026-01-09) - S1",
        )
    })
})

describe("buildBundle", () => {
    it("keys the checklist, the documents, the facts, the known and the open model findings", async () => {
        const subject = await subjectOf()
        const built = subject.buildBundle(inputOf())

        expect(built.bundle).toEqual({
            workspaceId: "w1",
            today: "2026-10-31",
            packVersion: "vn-llc-64@1",
            dossier: {
                ref: "2",
                name: "Charter",
                category: "LEGAL FILES",
                requirement: "required",
                basis: PACK.get("2")?.basis,
            },
            checklist: { key: "C1", text: "held: Charter; missing: Amended charter; drafts: Resolution" },
            related: [{ ref: "8", name: "Members register" }],
            documents: [
                {
                    key: "S1",
                    title: "02. Charter",
                    state: "actual",
                    date: "2026-01-09",
                    passages: [{ key: "S1.P1", text: "Charter capital is 300.000.000 VND" }],
                },
            ],
            facts: [
                {
                    key: "F1",
                    text: "Cong ty TNHH Mau | Charter capital = 300.000.000 VND (proposed, from 2026-01-09) - S1",
                },
                { key: "F2", text: "[8] Cong ty TNHH Mau | Charter capital = 285.000.000 (proposed)" },
            ],
            known: [{ key: "K1", text: "missing Lacks the signed charter" }],
            openAi: [{ key: "A1", text: "Charter names a former member - Article 5" }],
        })
        expect(built.keys).toEqual({
            sources: new Map([["S1", "s1"]]),
            passages: new Map([["S1.P1", { passageId: "p1", sourceId: "s1" }]]),
            facts: new Map([
                ["F1", "f1"],
                ["F2", "f8"],
            ]),
            openAi: new Map([["A1", "fpA"]]),
        })
        expect(built.chars).toBeGreaterThan(0)
    })

    it("puts actual documents first, newest first, then drafts and templates, and leaves out a fact shown already", async () => {
        const subject = await subjectOf()
        const built = subject.buildBundle(
            inputOf({
                inputs: inputsOf({
                    entry: null,
                    dossier: dossierOf(BARE),
                    documents: [
                        documentOf({ id: "t", state: "template", date: null, passages: [] }),
                        documentOf({ id: "d", state: "draft", date: null, passages: [] }),
                        documentOf({ id: "old", date: null, passages: [] }),
                        documentOf({ id: "older", date: null, passages: [] }),
                        documentOf({ id: "new", date: "2026-08-20", passages: [] }),
                    ],
                }),
                related: [inputsOf({ facts: [factOf()] })],
                known: [],
                openAi: [],
            }),
        )

        expect(built.bundle.dossier).toMatchObject({ requirement: "unknown", basis: [] })
        expect(built.bundle.checklist).toBeNull()
        expect([...built.keys.sources.values()]).toEqual(["new", "old", "older", "d", "t"])
        expect(built.bundle.facts).toEqual([
            { key: "F1", text: "Cong ty TNHH Mau | Charter capital = 300.000.000 VND (proposed, from 2026-01-09)" },
        ])
    })
})

describe("buildBundle caps", () => {
    it("clips the checklist and the passages, and stops a document at 3,000 characters", async () => {
        const subject = await subjectOf()
        const long = "x".repeat(1_500)
        const built = subject.buildBundle(
            inputOf({
                inputs: inputsOf({
                    dossier: dossierOf({ ...BARE, existing: long }),
                    documents: [
                        documentOf({
                            passages: [
                                passageOf({ id: "a", text: long }),
                                passageOf({ id: "b", text: long }),
                                passageOf({ id: "c", text: long }),
                                passageOf({ id: "d", text: long }),
                            ],
                        }),
                    ],
                }),
            }),
        )

        expect(built.bundle.checklist?.text).toHaveLength(1_200)
        expect(built.bundle.documents[0]?.passages.map((item) => item.text.length)).toEqual([1_200, 1_200, 600])
    })

    it("keeps at most 120 facts of the dossier and 60 of the related ones", async () => {
        const subject = await subjectOf()
        const many = (prefix: string, count: number): ReadonlyArray<ReviewFact> =>
            Array.from({ length: count }, (_, index) => factOf({ id: `${prefix}${index}` }))
        const built = subject.buildBundle(
            inputOf({ inputs: inputsOf({ facts: many("own", 121) }), related: [inputsOf({ facts: many("rel", 61) })] }),
        )

        expect(built.bundle.facts).toHaveLength(180)
    })

    it("stops at 24,000 characters: no more passages, facts, known or open model findings", async () => {
        const subject = await subjectOf()
        const long = "y".repeat(1_200)
        const documents = Array.from({ length: 12 }, (_, index) =>
            documentOf({
                id: `s${index}`,
                passages: [1, 2, 3].map((order) => passageOf({ id: `p${index}-${order}`, text: long })),
            }),
        )
        const big = "z".repeat(500)
        const built = subject.buildBundle(
            inputOf({
                inputs: inputsOf({ documents, facts: [factOf({ value: big })] }),
                related: [],
                known: [{ kind: "missing", title: big }],
                openAi: [{ fingerprint: "fpA", title: big, detail: big }],
            }),
        )

        expect(built.chars).toBeLessThanOrEqual(24_000)
        expect(built.bundle.documents).toHaveLength(12)
        expect(built.bundle.documents[11]?.passages).toEqual([])
        expect(built.bundle.facts).toEqual([])
        expect(built.bundle.known).toEqual([])
        expect(built.bundle.openAi).toEqual([])
    })
})

const KEYS: BundleKeys = {
    sources: new Map([
        ["S1", "s1"],
        ["S2", "s2"],
    ]),
    passages: new Map([
        ["S1.P1", { passageId: "p1", sourceId: "s1" }],
        ["S2.P1", { passageId: "gone", sourceId: "s2" }],
    ]),
    facts: new Map([["F1", "f1"]]),
    openAi: new Map([["A1", "fpA"]]),
}
const CORPUS: EvidenceCorpus = {
    sources: new Map([["s1", "02. Charter"]]),
    passages: new Map([["p1", "Charter capital is 300.000.000 VND"]]),
    facts: new Map([["f1", { value: "300.000.000", quotes: [] }]]),
}
const NONE = { sourceId: null, sourceTitle: null, passageId: null, factId: null, factLine: null }

describe("citedEvidence", () => {
    it.each([
        ["a passage key", "S1.P1", "300", { sourceId: "s1", sourceTitle: "02. Charter", passageId: "p1" }],
        ["a fact key", "F1", "300.000.000", { factId: "f1" }],
        ["a document key", "S1", "CAPITAL is", { sourceId: "s1", sourceTitle: "02. Charter", passageId: "p1" }],
        [
            "a document key the quote is not in",
            "S1",
            "nowhere",
            { sourceId: "s1", sourceTitle: "02. Charter", passageId: "unknown" },
        ],
        ["a document key the corpus lacks", "S2", "x", { sourceId: "s2", passageId: "unknown" }],
        ["an unknown key", "K1", "x", { passageId: "unknown" }],
    ])("resolves %s", async (_case, key, quote, fields) => {
        const subject = await subjectOf()

        expect(subject.citedEvidence({ key, quote }, "claim", KEYS, CORPUS)).toEqual({
            ...NONE,
            role: "claim",
            label: key,
            quote,
            ...fields,
        })
    })

    it("makes the checklist row context without a quote", async () => {
        const subject = await subjectOf()

        expect(subject.citedEvidence({ key: "C1", quote: "x" }, "claim", KEYS, CORPUS)).toEqual({
            ...NONE,
            role: "context",
            label: "C1",
            quote: null,
        })
    })
})

describe("corpusOf", () => {
    it("collects the titles, passages and facts of the dossiers", async () => {
        const subject = await subjectOf()
        const corpus = subject.corpusOf([inputsOf(), relatedOf()])

        expect(corpus.sources).toEqual(
            new Map([
                ["s1", "02. Charter"],
                ["s8", "08. Register"],
            ]),
        )
        expect(corpus.passages.get("p8")).toBe("Member A holds 64%")
        expect(corpus.facts.get("f8")).toEqual({ value: "285.000.000", quotes: ["capital is 300.000.000"] })
    })
})

const builtOf = (): BuiltBundle => buildBundle(inputOf())

describe("reasonedCandidates", () => {
    it("makes model candidates of the dossier, keeping only related dossiers of the pass and bounded text", async () => {
        const subject = await subjectOf()
        const built = builtOf()
        const corpus = subject.corpusOf([inputsOf(), relatedOf()])
        const [candidate] = subject.reasonedCandidates(reviewOf(), built, inputsOf(), [relatedOf()], corpus)

        expect(candidate).toEqual({
            ruleKey: "ai",
            dossierId: "d2",
            relatedDossierIds: ["d8"],
            kind: "contradiction",
            severity: "high",
            origin: "ai",
            code: null,
            params: {},
            title: "Capital differs",
            detail: "The register says otherwise",
            evidence: [
                expect.objectContaining({ role: "claim", passageId: "p1", sourceId: "s1" }),
                expect.objectContaining({ role: "counter", factId: "f8" }),
            ],
            remedyAction: "decide",
            remedyDocumentType: null,
            subject: "",
        })
    })

    it("gives context roles outside a contradiction, clips the text and falls back to decide", async () => {
        const subject = await subjectOf()
        const finding = findingOf({
            kind: "missing",
            title: "t".repeat(250),
            detail: "d".repeat(1_100),
            remedyAction: "pray",
            documentType: "x".repeat(90),
            relatedRefs: [],
        })
        const [candidate] = subject.reasonedCandidates(
            reviewOf({ findings: [finding] }),
            builtOf(),
            inputsOf(),
            [],
            CORPUS,
        )

        expect(candidate?.evidence.map((item) => item.role)).toEqual(["claim", "context"])
        expect(candidate?.title).toHaveLength(200)
        expect(candidate?.detail).toHaveLength(1_000)
        expect(candidate?.remedyAction).toBe("decide")
        expect(candidate?.remedyDocumentType).toHaveLength(80)
        expect(candidate?.relatedDossierIds).toEqual([])
    })
})

describe("resolvedByModel", () => {
    const changed = new Map([["s1", "2026-10-20T00:00:00.000Z"]])
    const firstSeen = new Map([["fpA", "2026-10-01T00:00:00.000Z"]])
    const closing = (quote: string, key = "A1", applies = false) => ({
        key,
        applies,
        evidence: [{ key: "S1.P1", quote }],
    })

    it("resolves an open model finding the model closed with verified evidence of a newer document", async () => {
        const subject = await subjectOf()
        const review = reviewOf({ stillOpen: [closing("300.000.000")] })

        expect(subject.resolvedByModel(review, builtOf(), CORPUS, changed, firstSeen)).toEqual(new Set(["fpA"]))
    })

    it.each([
        ["it still applies", [closing("300.000.000", "A1", true)], changed, firstSeen],
        ["the key is unknown", [closing("300.000.000", "A9")], changed, firstSeen],
        ["the quote does not verify", [closing("no such words here")], changed, firstSeen],
        [
            "only a fact resolves it",
            [{ key: "A1", applies: false, evidence: [{ key: "F1", quote: "300.000.000" }] }],
            changed,
            firstSeen,
        ],
        [
            "the document is not newer",
            [closing("300.000.000")],
            changed,
            new Map([["fpA", "2026-10-25T00:00:00.000Z"]]),
        ],
        ["no change or first sighting is known", [closing("300.000.000")], new Map(), new Map()],
    ])("leaves it when %s", async (_case, stillOpen, changedAt, seen) => {
        const subject = await subjectOf()

        expect(subject.resolvedByModel(reviewOf({ stillOpen }), builtOf(), CORPUS, changedAt, seen)).toEqual(new Set())
    })
})

describe("inputsFingerprintOf", () => {
    it("is stable under order and changes with a document, a fact or an open rule finding", async () => {
        const subject = await subjectOf()
        const base = inputsOf({
            documents: [documentOf(), documentOf({ id: "s2" })],
            facts: [factOf(), factOf({ id: "f2" })],
        })
        const reordered = inputsOf({
            documents: [documentOf({ id: "s2" }), documentOf()],
            facts: [factOf({ id: "f2" }), factOf()],
        })
        const fingerprint = subject.inputsFingerprintOf(base, ["b", "a"])

        expect(fingerprint).toMatch(/^[\da-f]{32}$/u)
        expect(subject.inputsFingerprintOf(reordered, ["a", "b"])).toBe(fingerprint)
        const plain = subject.inputsFingerprintOf(inputsOf(), [])
        const others = [
            subject.inputsFingerprintOf(inputsOf({ documents: [documentOf({ chunkCount: 2 })] }), []),
            subject.inputsFingerprintOf(inputsOf({ facts: [factOf({ status: "active" })] }), []),
            subject.inputsFingerprintOf(inputsOf(), ["c"]),
        ]
        expect(others.filter((other) => other === plain)).toEqual([])
    })
})

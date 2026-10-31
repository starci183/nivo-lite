import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, PackEntry, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { latestEvent, outdatedRules } from "./outdated.policy"

const SUBJECT = Symbol("outdated.policy")
type Subject = { latestEvent: typeof latestEvent; outdatedRules: typeof outdatedRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { latestEvent, outdatedRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factOf = builder<ReviewFact>({
    id: "e1",
    subjectKey: "cong-ty-tnhh-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "ngay-chuyen-nhuong-von",
    attributeLabel: "Ngay chuyen nhuong von",
    value: "17/08/2026",
    valueNumber: null,
    unit: null,
    status: "proposed",
    validFrom: null,
    validTo: null,
    conflictWith: null,
    sourceIds: ["s20"],
    quotes: [],
    updatedAt: "2026-08-18T00:00:00.000Z",
})

const docOf = builder<DocumentInput>({
    id: "s2",
    title: "02. Dieu le cong ty",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-01-09",
    updatedAt: "2026-01-10T00:00:00.000Z",
    chunkCount: 1,
    passages: [],
})

const entryOf = builder<PackEntry>({
    ref: "2",
    nameHint: ["dieu-le"],
    requirement: "required",
    basis: [],
    expects: [],
    mustReflect: ["capital_transfer", "member_change"],
    tracksExpiry: false,
    related: [],
    remedy: { documentType: "Nghi quyet", guidance: "Draft it", action: "draft" },
})

const dossierOf = (
    id: string,
    docs: ReadonlyArray<DocumentInput>,
    facts: ReadonlyArray<ReviewFact>,
    entry: PackEntry | null,
): DossierInputs => ({
    dossier: {
        id,
        ref: id.slice(1),
        name: "Dieu le",
        category: "LEGAL",
        position: 1,
        checklistStatus: "present",
        existing: null,
        missing: null,
        drafts: null,
    },
    entry,
    documents: docs,
    facts,
})

const EVENTS = [
    factOf(),
    factOf({ id: "e0", value: "2026-03-01" }),
    factOf({ id: "e9", value: "2026-12-01" }),
    factOf({ id: "e8", value: "none" }),
    factOf({ id: "x1", attribute: "von-dieu-le", value: "2026-09-01" }),
]

const contextOf = (charter: DossierInputs): ReviewContext => ({
    today: "2026-10-31",
    dossiers: [charter, dossierOf("d20", [docOf({ id: "s20", title: "20. Nghi quyet" })], EVENTS, null)],
    activeFacts: [],
})

describe("latestEvent", () => {
    it("answers the latest past occurrence of the event among the facts", async () => {
        const subject = await buildSubject()

        expect(subject.latestEvent(EVENTS, "capital_transfer", "2026-10-31")).toEqual([
            { fact: EVENTS[0], date: "2026-08-17" },
        ])
        expect(subject.latestEvent(EVENTS, "member_change", "2026-10-31")).toEqual([])
    })
})

describe("outdatedRules", () => {
    it("finds a dossier whose every actual document predates an event it must reflect", async () => {
        const subject = await buildSubject()
        const charter = dossierOf("d2", [docOf(), docOf({ id: "s3", date: "2026-01-05" })], [], entryOf())

        const found = subject.outdatedRules(contextOf(charter))

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "outdated.after_event",
                dossierId: "d2",
                kind: "outdated",
                severity: "high",
                code: "outdated_after_event",
                subject: "capital_transfer",
                params: {
                    dossier: "2. Dieu le",
                    event: "Ngay chuyen nhuong von",
                    eventDate: "17/08/2026",
                    documentDate: "09/01/2026",
                },
                remedyAction: "draft",
                remedyDocumentType: "Nghi quyet",
            }),
        ])
        expect(found[0]?.evidence.map((item) => [item.role, item.factId, item.sourceId, item.label])).toEqual([
            ["event", "e1", "s20", "Ngay chuyen nhuong von"],
            ["claim", null, "s2", "09/01/2026"],
        ])
    })

    it("finds nothing when a document is dated after the event, one is undated, there is none, or the pack names no event", async () => {
        const subject = await buildSubject()
        const updated = dossierOf("d2", [docOf({ date: "2026-08-20" })], [], entryOf())
        const undated = dossierOf("d2", [docOf(), docOf({ id: "s3", date: null })], [], entryOf())
        const draftsOnly = dossierOf("d2", [docOf({ state: "draft" })], [], entryOf())
        const unknown = dossierOf("d2", [docOf()], [], null)

        expect(subject.outdatedRules(contextOf(updated))).toEqual([])
        expect(subject.outdatedRules(contextOf(undated))).toEqual([])
        expect(subject.outdatedRules(contextOf(draftsOnly))).toEqual([])
        expect(subject.outdatedRules(contextOf(unknown))).toEqual([])
    })
})

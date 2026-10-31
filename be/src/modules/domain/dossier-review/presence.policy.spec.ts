import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type {
    DocumentInput,
    DossierInputs,
    DossierRef,
    Expectation,
    PackEntry,
    ReviewContext,
    ReviewFact,
} from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import { meetingDocuments, meets, presenceRules } from "./presence.policy"

const SUBJECT = Symbol("presence.policy")
type Subject = { meets: typeof meets; meetingDocuments: typeof meetingDocuments; presenceRules: typeof presenceRules }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { meets, meetingDocuments, presenceRules } }],
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

const entry = (ref: string): PackEntry | null => PACK.get(ref) ?? null
const legalRep = factOf({
    id: "f6",
    attribute: "nguoi-dai-dien-theo-phap-luat",
    attributeLabel: "Nguoi dai dien theo phap luat",
    value: "Nguyen Van A",
    validFrom: "2026-08-20",
})
const registration = inputsOf({ documents: [docOf()], facts: [legalRep] })
const representative = (documents: ReadonlyArray<DocumentInput>): DossierInputs =>
    inputsOf({
        dossier: dossierOf({ id: "d6", ref: "6", name: "Ho so nguoi dai dien theo phap luat" }),
        entry: entry("6"),
        documents,
    })
const charter = (documents: ReadonlyArray<DocumentInput>): DossierInputs =>
    inputsOf({ dossier: dossierOf({ id: "d2", ref: "2", name: "Dieu le cong ty" }), entry: entry("2"), documents })

describe("presence.expected", () => {
    it("A3: the legal representative's file holds no CCCD naming the current representative", async () => {
        const subject = await buildSubject()
        const context = contextOf({
            dossiers: [registration, representative([docOf({ id: "s6", title: "06. Giay to nguoi dai dien" })])],
        })
        const label = entry("6")?.expects[0]?.label

        expect(subject.presenceRules(context)).toEqual([
            {
                ruleKey: "presence.expected",
                dossierId: "d6",
                relatedDossierIds: [],
                kind: "missing",
                severity: "medium",
                origin: "rule",
                code: "presence_expected_holder",
                params: {
                    dossier: "6. Ho so nguoi dai dien theo phap luat",
                    expectation: label,
                    holder: "Nguyen Van A",
                },
                title: "",
                detail: "",
                evidence: [
                    expect.objectContaining({ role: "expected", label }),
                    expect.objectContaining({ role: "context", factId: "f6", sourceId: "s1" }),
                ],
                remedyAction: "upload",
                remedyDocumentType: null,
                subject: "legal_representative_id:nguyen van a",
            },
        ])
    })

    it("A3 negative: a CCCD scan naming the representative meets it", async () => {
        const subject = await buildSubject()
        const scan = docOf({ id: "s6", title: "06. CCCD Nguyen Van A" })
        expect(subject.presenceRules(contextOf({ dossiers: [registration, representative([scan])] }))).toEqual([])
    })

    it("without a known holder, any document carrying the words meets an expectation about a role", async () => {
        const subject = await buildSubject()
        const passage = { id: "p1", order: 0, text: "Ban sao can cuoc" }
        const scan = docOf({ id: "s6", title: "06. Ban sao", passages: [passage] })
        expect(subject.presenceRules(contextOf({ dossiers: [representative([scan])] }))).toEqual([])
        const other = docOf({ id: "s7", title: "06. Thu xac nhan" })
        expect(subject.presenceRules(contextOf({ dossiers: [representative([other])] }))).toEqual([
            expect.objectContaining({ code: "presence_expected", subject: "legal_representative_id" }),
        ])
    })
})

describe("presence.expected without a holder to name", () => {
    it("a signed expectation about a role counts only actual documents naming the holder", async () => {
        const subject = await buildSubject()
        const signedAbout: Expectation = {
            key: "appointment",
            label: "Quyet dinh",
            titleAny: ["quyet dinh"],
            textAny: [],
            about: "legal_representative",
            signed: true,
            severity: "high",
        }
        const custom = inputsOf({
            dossier: dossierOf({ id: "d9", ref: "9", name: "Bo nhiem" }),
            entry: {
                ref: "9",
                nameHint: ["bo-nhiem"],
                requirement: "required",
                basis: [],
                expects: [signedAbout],
                mustReflect: [],
                tracksExpiry: false,
                related: [],
                remedy: null,
            },
            documents: [docOf({ id: "s9", title: "Du thao quyet dinh Nguyen Van A", state: "draft" })],
        })
        expect(subject.presenceRules(contextOf({ dossiers: [registration, custom] }))).toEqual([
            expect.objectContaining({ code: "presence_expected_holder", remedyAction: "upload" }),
        ])
    })

    it("files a missing expectation of a dossier that holds documents; a draft meets one that need not be signed", async () => {
        const subject = await buildSubject()
        const minutes = docOf({ id: "s2", title: "02. Bien ban" })
        expect(subject.presenceRules(contextOf({ dossiers: [charter([minutes])] }))).toEqual([
            expect.objectContaining({
                ruleKey: "presence.expected",
                code: "presence_expected",
                severity: "high",
                remedyAction: "draft",
                subject: "charter",
            }),
        ])
        const draft = docOf({ id: "s3", title: "02. Du thao dieu le", state: "draft" })
        expect(subject.presenceRules(contextOf({ dossiers: [charter([draft])] }))).toEqual([])
        expect(subject.presenceRules(contextOf({ dossiers: [inputsOf({ documents: [docOf()] })] }))).toEqual([])
    })
})

describe("presence.dossier", () => {
    it("files a required dossier with neither a document nor a draft, never an optional one or one outside the pack", async () => {
        const subject = await buildSubject()
        const templateOnly = docOf({ id: "s4", title: "02. Mau", state: "template" })
        const context = contextOf({
            dossiers: [
                charter([templateOnly]),
                inputsOf({ dossier: dossierOf({ id: "d27", ref: "27", name: "Quy che KPI" }), entry: entry("27") }),
                inputsOf(),
            ],
        })
        expect(subject.presenceRules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "presence.dossier",
                dossierId: "d2",
                code: "presence_dossier",
                params: { dossier: "2. Dieu le cong ty" },
                evidence: [expect.objectContaining({ role: "expected", label: "Dieu le cong ty" })],
                subject: "documents",
            }),
        ])
    })
})

describe("meets and meetingDocuments", () => {
    it("matches a title or a passage and splits actual documents from drafts", async () => {
        const subject = await buildSubject()
        const expectation: Expectation = {
            key: "charter",
            label: "Dieu le",
            titleAny: ["dieu le"],
            textAny: ["dieu le"],
            about: null,
            signed: true,
            severity: "high",
        }
        const byText = docOf({
            id: "s5",
            title: "Ban goc",
            passages: [{ id: "p1", order: 0, text: "DIEU LE cong ty" }],
        })
        const draft = docOf({ id: "s6", title: "Dieu le (du thao)", state: "draft" })
        expect(subject.meets(byText, expectation)).toBe(true)
        expect(subject.meets(docOf(), expectation)).toBe(false)
        expect(subject.meetingDocuments(charter([byText, draft, docOf()]), expectation)).toEqual({
            actual: [byText],
            drafts: [draft],
        })
    })
})

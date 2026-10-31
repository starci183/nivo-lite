import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, DossierRef, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { currentHolders, holdingsOf, roleRules } from "./roles.policy"

const SUBJECT = Symbol("roles.policy")
type Subject = { holdingsOf: typeof holdingsOf; currentHolders: typeof currentHolders; roleRules: typeof roleRules }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { holdingsOf, currentHolders, roleRules } }],
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

const ACCOUNTANT = { attribute: "nguoi-phu-trach-ke-toan", attributeLabel: "Nguoi phu trach ke toan" } as const
const bankOld = factOf({ id: "f1", subject: "Ngan hang A", ...ACCOUNTANT, value: "Nguyen Van B", sourceIds: ["s5"] })
const bankNew = factOf({ id: "f3", subject: "Ngan hang C", ...ACCOUNTANT, value: "Nguyen Van A", sourceIds: ["s5b"] })
const decision = factOf({ id: "f2", ...ACCOUNTANT, value: "Nguyen Van A", validFrom: "2026-08-01", sourceIds: ["s23"] })
const bank = (facts: ReadonlyArray<ReviewFact>): DossierInputs =>
    inputsOf({
        dossier: dossierOf({ id: "d5", ref: "5", name: "Tai khoan ngan hang" }),
        documents: [
            docOf({ id: "s5", title: "05. Ngan hang A", date: "2026-01-15" }),
            docOf({ id: "s5b", title: "05. Ngan hang C" }),
        ],
        facts,
    })
const appointments = (facts: ReadonlyArray<ReviewFact>): DossierInputs =>
    inputsOf({
        dossier: dossierOf({ id: "d23", ref: "23", name: "Quyet dinh bo nhiem" }),
        documents: [docOf({ id: "s23", title: "23. QD 04", date: "2026-08-01" })],
        facts,
    })

describe("roles.holders", () => {
    it("A4: two people named accountant at once, filed under the dossier still naming the former one", async () => {
        const subject = await buildSubject()
        const context = contextOf({ dossiers: [bank([bankOld, bankNew]), appointments([decision])] })

        const [finding, ...rest] = subject.roleRules(context)

        expect(rest).toEqual([])
        expect(finding).toEqual(
            expect.objectContaining({
                ruleKey: "roles.holders",
                dossierId: "d5",
                relatedDossierIds: ["d23"],
                kind: "contradiction",
                severity: "high",
                code: "roles_holders",
                params: { role: "Nguoi phu trach ke toan", holders: "Nguyen Van B, Nguyen Van A" },
                remedyAction: "decide",
                subject: "accountant:nguyen van a,nguyen van b",
            }),
        )
        expect(finding?.evidence.map((item) => [item.factId, item.role])).toEqual([
            ["f1", "claim"],
            ["f3", "counter"],
            ["f2", "counter"],
        ])
    })

    it("A4 negative: the former holder's span ended before the new one began", async () => {
        const subject = await buildSubject()
        const ended = factOf({ ...bankOld, validTo: "2026-07-31" })
        const context = contextOf({ dossiers: [bank([ended]), appointments([decision])] })
        expect(subject.roleRules(context)).toEqual([])
    })

    it("reads a person's title fact, and files nothing when the stale holder's documents are outside the pass", async () => {
        const subject = await buildSubject()
        const titled = factOf({
            id: "f4",
            subject: "Nguyen Van C",
            attribute: "chuc-danh",
            attributeLabel: "Chuc danh",
            value: "Ke toan truong",
            sourceIds: ["sx"],
        })
        const director = factOf({ id: "f5", subject: "Nguyen Van D", attribute: "chuc-danh", value: "Giam doc" })
        const context = contextOf({ dossiers: [appointments([decision, titled, director])] })
        expect(subject.roleRules(context)).toEqual([])
    })

    it("relates only the dossiers in the pass", async () => {
        const subject = await buildSubject()
        const outside = factOf({ ...decision, sourceIds: ["sx"] })
        const context = contextOf({ dossiers: [bank([bankOld, outside])] })
        expect(subject.roleRules(context)).toEqual([
            expect.objectContaining({ ruleKey: "roles.holders", dossierId: "d5", relatedDossierIds: [] }),
        ])
    })
})

describe("roles.left", () => {
    const leave = (value: string, validFrom: string | null = null): ReviewFact =>
        factOf({
            id: "f9",
            subject: "Nguyen Van B",
            attribute: "ngay-nghi-viec",
            attributeLabel: "Ngay nghi viec",
            value,
            validFrom,
        })

    it("finds a person who left still named in an open role", async () => {
        const subject = await buildSubject()
        const context = contextOf({ dossiers: [bank([bankOld, leave("30/06/2026")])] })
        expect(subject.roleRules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "roles.left",
                dossierId: "d5",
                kind: "outdated",
                severity: "high",
                code: "roles_left",
                params: { person: "Nguyen Van B", role: "Nguoi phu trach ke toan", leftOn: "30/06/2026" },
                subject: "accountant:nguyen van b:f1",
                remedyAction: "decide",
            }),
        ])
    })

    it("ignores a leaving date to come, one it cannot read, an ended role and a role cited outside the pass", async () => {
        const subject = await buildSubject()
        const ended = factOf({ ...bankOld, id: "f6", validTo: "2026-06-30" })
        const outside = factOf({ ...bankOld, id: "f7", sourceIds: ["sx"] })
        const context = contextOf({ dossiers: [bank([ended, leave("30/11/2026")]), bank([outside, leave("chua ro")])] })
        expect(subject.roleRules(context)).toEqual([])
        expect(subject.roleRules(contextOf({ dossiers: [bank([outside, leave("30/06/2026")])] }))).toEqual([])
    })
})

describe("holdingsOf and currentHolders", () => {
    it("dates a holding by its validity, else by its first dated document", async () => {
        const subject = await buildSubject()
        const dates = new Map<string, string | null>([
            ["s5", null],
            ["s5b", "2026-02-01"],
        ])
        const holdings = subject.holdingsOf(
            [factOf({ ...bankOld, sourceIds: ["sx", "s5", "s5b"] }), decision, factOf({ id: "f8" })],
            "accountant",
            dates,
        )
        expect(holdings.map((holding) => [holding.key, holding.from, holding.to])).toEqual([
            ["nguyen van b", "2026-02-01", null],
            ["nguyen van a", "2026-08-01", null],
        ])
        expect(subject.holdingsOf([bankOld], "accountant", new Map())[0]?.from).toBeNull()
    })

    it("keeps each current holder once, the latest start first, and drops ended holdings", async () => {
        const subject = await buildSubject()
        const holdings = subject.holdingsOf(
            [
                factOf({ ...bankOld, validTo: "2026-09-30" }),
                decision,
                factOf({ ...decision, id: "f10", validFrom: null }),
                factOf({ ...bankNew, value: "Nguyen Van E", validFrom: "2026-03-01" }),
            ],
            "accountant",
            new Map(),
        )
        expect(
            subject.currentHolders(holdings, "2026-10-31").map((holding) => [holding.name, holding.fact.id]),
        ).toEqual([
            ["Nguyen Van A", "f2"],
            ["Nguyen Van E", "f3"],
        ])
        expect(subject.currentHolders(holdings, "2026-09-01").map((holding) => holding.name)).toEqual([
            "Nguyen Van A",
            "Nguyen Van E",
            "Nguyen Van B",
        ])
    })
})

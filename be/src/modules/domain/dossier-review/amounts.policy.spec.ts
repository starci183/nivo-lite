import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { amountRules } from "./amounts.policy"
import type { DocumentInput, DossierInputs, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"

const SUBJECT = Symbol("amounts.policy")
type Subject = { amountRules: typeof amountRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { amountRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    updatedAt: "2026-01-10T00:00:00.000Z",
})

const docOf = builder<DocumentInput>({
    id: "s1",
    title: "Document",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-01-09",
    updatedAt: "2026-01-10T00:00:00.000Z",
    chunkCount: 1,
    passages: [],
})

const dossierOf = (
    ref: string,
    docs: ReadonlyArray<DocumentInput>,
    facts: ReadonlyArray<ReviewFact>,
): DossierInputs => ({
    dossier: {
        id: `d${ref}`,
        ref,
        name: `Dossier ${ref}`,
        category: "LEGAL",
        position: Number(ref),
        checklistStatus: "present",
        existing: null,
        missing: null,
        drafts: null,
    },
    entry: null,
    documents: docs,
    facts,
})

const contextOf = (dossiers: ReadonlyArray<DossierInputs>, today = "2026-10-31"): ReviewContext => ({
    today,
    dossiers,
    activeFacts: [],
})

const capitalOf = (id: string, sourceId: string, value: string): ReviewFact =>
    factOf({ id, sourceIds: [sourceId], value })

describe("amountRules amounts.invariant", () => {
    it("files one contradiction under the charter when the charter capital differs, authority values first", async () => {
        const { amountRules: rules } = await buildSubject()
        const bank = capitalOf("f11", "s11", "285.000.000")
        const certificate = capitalOf("f1", "s1", "300.000.000")
        const charter = capitalOf("f2", "s2", "300 trieu")
        const context = contextOf([
            dossierOf("11", [docOf({ id: "s11", title: "Sao ke" })], [bank]),
            dossierOf("1", [docOf({ id: "s1", title: "GCN" })], [certificate]),
            dossierOf("2", [docOf({ id: "s2", title: "Dieu le" })], [charter]),
        ])

        const found = rules(context).filter((item) => item.ruleKey === "amounts.invariant")

        expect(found).toEqual([
            expect.objectContaining({
                dossierId: "d2",
                relatedDossierIds: ["d1", "d11"],
                kind: "contradiction",
                severity: "high",
                code: "amounts_invariant",
                subject: "charter_capital",
                params: { invariant: "Von dieu le", values: "300.000.000; 285.000.000" },
                remedyAction: "decide",
            }),
        ])
        expect(found[0]?.evidence.map((item) => [item.factId, item.role, item.sourceTitle])).toEqual([
            ["f1", "claim", "GCN"],
            ["f11", "counter", "Sao ke"],
        ])
    })
})

describe("amountRules amounts.invariant of the tax code", () => {
    it("files a tax code contradiction under the dossier of its first fact when the certificate dossier is not in the pass", async () => {
        const { amountRules: rules } = await buildSubject()
        const first = factOf({
            id: "t1",
            attribute: "ma-so-thue",
            attributeLabel: "MST",
            value: "0123456789",
            sourceIds: ["s5"],
        })
        const second = factOf({
            id: "t2",
            attribute: "mst",
            attributeLabel: "MST",
            value: "0123456788",
            sourceIds: ["s6"],
        })
        const blank = factOf({ id: "t3", attribute: "mst", value: "none", sourceIds: ["s6"] })
        const stray = factOf({ id: "t4", attribute: "mst", value: "0123456787", sourceIds: ["gone"] })
        const context = contextOf([
            dossierOf("5", [docOf({ id: "s5" })], [first]),
            dossierOf("6", [docOf({ id: "s6" })], [second, blank, stray]),
        ])

        expect(rules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "amounts.invariant",
                dossierId: "d5",
                relatedDossierIds: ["d6"],
                subject: "tax_code",
                params: { invariant: "MST", values: "0123456789; 0123456788; 0123456787" },
            }),
        ])
    })
})

describe("amountRules amounts.invariant that agrees", () => {
    it("finds nothing when the values agree, a value gives no amount, or the first fact files under no dossier of the pass", async () => {
        const { amountRules: rules } = await buildSubject()
        const agreeing = contextOf([
            dossierOf("1", [docOf()], [capitalOf("f1", "s1", "300.000.000"), capitalOf("f9", "s1", "unknown")]),
            dossierOf("2", [docOf({ id: "s2" })], [capitalOf("f2", "s2", "300.000.000")]),
        ])
        const orphan = contextOf([
            dossierOf(
                "5",
                [docOf({ id: "s5" })],
                [
                    factOf({ id: "t1", attribute: "mst", value: "0123456789", sourceIds: ["gone"] }),
                    factOf({ id: "t2", attribute: "mst", value: "0123456788", sourceIds: ["gone"] }),
                ],
            ),
        ])

        expect(rules(agreeing)).toEqual([])
        expect(rules(orphan)).toEqual([])
    })
})

const registered = factOf({
    id: "r1",
    attribute: "ngay-dang-ky-lan-dau",
    attributeLabel: "Ngay dang ky lan dau",
    value: "09/01/2026",
    sourceIds: ["s1"],
})
const later = factOf({ id: "r2", attribute: "ngay-thanh-lap", value: "2026-02-01", sourceIds: ["s1"] })
const undated = factOf({ id: "r3", attribute: "ngay-thanh-lap", value: "none", sourceIds: ["s1"] })
const contributedOf = (id: string, value: string, validFrom: string | null, updatedAt: string): ReviewFact =>
    factOf({
        id,
        attribute: "von-thuc-gop",
        attributeLabel: "Von thuc gop",
        value,
        validFrom,
        updatedAt,
        sourceIds: ["s10"],
    })
const passOf = (contributed: ReadonlyArray<ReviewFact>, today: string, registration = [later, registered, undated]) =>
    contextOf(
        [
            dossierOf("1", [docOf()], [capitalOf("f1", "s1", "300.000.000"), ...registration]),
            dossierOf("10", [docOf({ id: "s10", title: "Bien ban gop von" })], contributed),
        ],
        today,
    )

describe("amountRules amounts.contribution", () => {
    it("is critical once 90 days after the first registration have passed with the latest contributed total short", async () => {
        const { amountRules: rules } = await buildSubject()
        const contributed = [
            contributedOf("c1", "150.000.000", "2026-03-01", "2026-03-01T00:00:00.000Z"),
            contributedOf("c2", "182.000.000", "2026-05-01", "2026-05-01T00:00:00.000Z"),
            contributedOf("c3", "100.000.000", null, "2026-01-01T00:00:00.000Z"),
        ]

        expect(rules(passOf(contributed, "2026-10-31"))).toEqual([
            expect.objectContaining({
                ruleKey: "amounts.contribution",
                dossierId: "d10",
                relatedDossierIds: ["d1"],
                kind: "unreasonable",
                severity: "critical",
                code: "amounts_contribution_overdue",
                params: { contributed: "182.000.000", capital: "300.000.000", deadline: "09/04/2026" },
            }),
        ])
        expect(rules(passOf(contributed, "2026-10-31"))[0]?.evidence.map((item) => [item.factId, item.role])).toEqual([
            ["c2", "claim"],
            ["f1", "counter"],
            ["r1", "event"],
        ])
    })
})

describe("amountRules amounts.contribution before the deadline", () => {
    it("is low while the deadline is still ahead", async () => {
        const { amountRules: rules } = await buildSubject()
        const contributed = [contributedOf("c1", "182.000.000", null, "2026-02-01T00:00:00.000Z")]

        expect(rules(passOf(contributed, "2026-02-15"))).toEqual([
            expect.objectContaining({ severity: "low", code: "amounts_contribution_open" }),
        ])
    })
})

describe("amountRules amounts.contribution that holds", () => {
    it("finds nothing when the contribution is full, no registration date is known, or no dossier holds it", async () => {
        const { amountRules: rules } = await buildSubject()
        const full = [contributedOf("c1", "300.000.000", null, "2026-02-01T00:00:00.000Z")]
        const short = [contributedOf("c1", "182.000.000", null, "2026-02-01T00:00:00.000Z")]
        const homeless = contextOf([
            dossierOf(
                "1",
                [docOf()],
                [
                    capitalOf("f1", "s1", "300.000.000"),
                    registered,
                    factOf({ id: "c9", attribute: "von-da-gop", value: "100.000.000", sourceIds: ["gone"] }),
                ],
            ),
        ])

        expect(rules(passOf(full, "2026-10-31"))).toEqual([])
        expect(rules(passOf(short, "2026-10-31", [undated]))).toEqual([])
        expect(rules(homeless)).toEqual([])
    })
})

const shareOf = (id: string, member: string, value: string, sourceId = "s8", validFrom: string | null = null) =>
    factOf({
        id,
        subjectKey: member,
        subject: member.toUpperCase(),
        attribute: "ty-le-von-gop",
        attributeLabel: "Ty le von gop",
        value,
        validFrom,
        sourceIds: [sourceId],
    })
const memberCapitalOf = (id: string, member: string, value: string) =>
    factOf({ id, subjectKey: member, subject: member, attribute: "phan-von-gop", value, sourceIds: ["s8"] })

describe("amountRules amounts.shares", () => {
    it("flags shares that miss 100 % and a member capital that is not its share of the charter capital", async () => {
        const { amountRules: rules } = await buildSubject()
        const facts = [
            shareOf("p0", "a", "95%", "s8", "2026-01-09"),
            shareOf("p1", "a", "64%", "s8", "2026-08-17"),
            shareOf("p2", "b", "30%"),
            shareOf("p3", "c", "none"),
            memberCapitalOf("m1", "a", "192.000.000"),
            memberCapitalOf("m2", "b", "100.000.000"),
        ]
        const context = contextOf([
            dossierOf("2", [docOf({ id: "s2" })], [capitalOf("f2", "s2", "300.000.000")]),
            dossierOf("8", [docOf({ id: "s8" })], facts),
        ])

        expect(rules(context)).toEqual([
            expect.objectContaining({
                ruleKey: "amounts.shares",
                dossierId: "d8",
                subject: "total",
                code: "amounts_shares_total",
                params: { total: "94" },
            }),
            expect.objectContaining({
                ruleKey: "amounts.shares",
                dossierId: "d8",
                subject: "capital:b",
                code: "amounts_shares_capital",
                params: { member: "B", capital: "100.000.000", expected: "90.000.000" },
            }),
        ])
    })
})

describe("amountRules amounts.shares that hold", () => {
    it("finds nothing for shares that make 100 % without member capitals, nor for one member, nor without a charter capital", async () => {
        const { amountRules: rules } = await buildSubject()
        const whole = contextOf([
            dossierOf("8", [docOf({ id: "s8" })], [shareOf("p1", "a", "64"), shareOf("p2", "b", "36")]),
        ])
        const single = contextOf([dossierOf("8", [docOf({ id: "s8" })], [shareOf("p1", "a", "64")])])

        expect(rules(whole)).toEqual([])
        expect(rules(single)).toEqual([])
    })
})

describe("amountRules amounts.shares without a members register", () => {
    it("files a wrong total under the first member's dossier without a members register, and skips shares filed nowhere", async () => {
        const { amountRules: rules } = await buildSubject()
        const context = contextOf([
            dossierOf("5", [docOf({ id: "s5" })], [shareOf("p1", "a", "60", "s5"), shareOf("p2", "b", "30", "s5")]),
        ])
        const nowhere = contextOf([
            dossierOf(
                "2",
                [docOf({ id: "s2" })],
                [
                    capitalOf("f2", "s2", "300.000.000"),
                    shareOf("p1", "a", "60", "gone"),
                    shareOf("p2", "b", "30", "gone"),
                    memberCapitalOf("m1", "a", "1"),
                ],
            ),
        ])

        expect(rules(context)).toEqual([
            expect.objectContaining({ dossierId: "d5", subject: "total", params: { total: "90" } }),
        ])
        expect(rules(nowhere)).toEqual([])
    })
})

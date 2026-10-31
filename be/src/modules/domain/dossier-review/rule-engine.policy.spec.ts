import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import { RULE_KEYS, runRules } from "./rule-engine.policy"

const SUBJECT = Symbol("rule-engine.policy")
type Subject = { runRules: typeof runRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factOf = builder<ReviewFact>({
    id: "f1",
    subjectKey: "cong-ty-tnhh-mau",
    subject: "C\u00f4ng ty TNHH M\u1eabu",
    attribute: "von-dieu-le",
    attributeLabel: "V\u1ed1n \u0111i\u1ec1u l\u1ec7",
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

/** A dossier of the standard set with its pack entry. */
const dossierOf = (
    ref: string,
    name: string,
    docs: ReadonlyArray<DocumentInput>,
    facts: ReadonlyArray<ReviewFact>,
): DossierInputs => ({
    dossier: {
        id: `d${ref}`,
        ref,
        name,
        category: "H\u1ed2 S\u01a0 PH\u00c1P L\u00dd",
        position: Number(ref),
        checklistStatus: "partial",
        existing: null,
        missing: null,
        drafts: null,
    },
    entry: PACK.get(ref) ?? null,
    documents: docs,
    facts,
})

const contextOf = (dossiers: ReadonlyArray<DossierInputs>): ReviewContext => ({
    today: "2026-10-31",
    dossiers,
    activeFacts: [],
})

const passage = (id: string, text: string) => ({ id, order: 0, text })

describe("runRules", () => {
    it("evaluates every rule for every dossier of the pass", async () => {
        const subject = await buildSubject()
        const output = subject.runRules(
            contextOf([dossierOf("7", "C\u00f4ng v\u0103n", [], []), dossierOf("9", "Danh s\u00e1ch", [], [])]),
        )

        expect(output.coverage).toHaveLength(RULE_KEYS.length * 2)
        expect(output.coverage).toContain("presence.expected|d7")
        expect(output.coverage).toContain("values.dates|d9")
        expect(output.candidates).toEqual([])
    })
})

describe("acceptance A1: the charter was not updated after the capital transfer", () => {
    const transfer = factOf({
        id: "e1",
        attribute: "ngay-chuyen-nhuong-von",
        attributeLabel: "Ng\u00e0y chuy\u1ec3n nh\u01b0\u1ee3ng v\u1ed1n",
        value: "17/08/2026",
        sourceIds: ["s20"],
    })
    const passOf = (charterDate: string): ReviewContext =>
        contextOf([
            dossierOf(
                "2",
                "\u0110i\u1ec1u l\u1ec7 c\u00f4ng ty TNHH hai th\u00e0nh vi\u00ean",
                [
                    docOf({
                        id: "s2",
                        title: "02. \u0110i\u1ec1u l\u1ec7 c\u00f4ng ty",
                        date: charterDate,
                        passages: [passage("p2", "\u0110i\u1ec1u l\u1ec7 c\u00f4ng ty TNHH M\u1eabu")],
                    }),
                ],
                [],
            ),
            dossierOf(
                "20",
                "Ngh\u1ecb quy\u1ebft H\u1ed9i \u0111\u1ed3ng th\u00e0nh vi\u00ean",
                [docOf({ id: "s20", title: "20. Ngh\u1ecb quy\u1ebft 01", date: "2026-08-17" })],
                [transfer],
            ),
        ])

    it("finds the charter outdated, dated at founding before the transfer of 17/08/2026", async () => {
        const subject = await buildSubject()
        const found = subject.runRules(passOf("2026-01-09")).candidates.filter((item) => item.dossierId === "d2")

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "outdated.after_event",
                kind: "outdated",
                severity: "high",
                subject: "capital_transfer",
                remedyAction: "draft",
            }),
        ])
        expect(found[0]?.params).toEqual({
            dossier: "2. \u0110i\u1ec1u l\u1ec7 c\u00f4ng ty TNHH hai th\u00e0nh vi\u00ean",
            event: "Ng\u00e0y chuy\u1ec3n nh\u01b0\u1ee3ng v\u1ed1n",
            eventDate: "17/08/2026",
            documentDate: "09/01/2026",
        })
    })

    it("finds nothing for a charter dated after the transfer", async () => {
        const subject = await buildSubject()

        expect(subject.runRules(passOf("2026-08-20")).candidates.filter((item) => item.dossierId === "d2")).toEqual([])
    })
})

describe("acceptance A2: the charter capital disagrees with the bank statements", () => {
    const passOf = (bankCapital: string, contributed: string): ReviewContext =>
        contextOf([
            dossierOf(
                "1",
                "Gi\u1ea5y ch\u1ee9ng nh\u1eadn \u0110KDN",
                [docOf({ id: "s1", title: "01. GCN \u0110KDN" })],
                [
                    factOf({ id: "c1", sourceIds: ["s1"] }),
                    factOf({
                        id: "r1",
                        attribute: "ngay-dang-ky-lan-dau",
                        attributeLabel: "Ng\u00e0y \u0111\u0103ng k\u00fd l\u1ea7n \u0111\u1ea7u",
                        value: "09/01/2026",
                        sourceIds: ["s1"],
                    }),
                ],
            ),
            dossierOf(
                "2",
                "\u0110i\u1ec1u l\u1ec7 c\u00f4ng ty",
                [docOf({ id: "s2", title: "02. \u0110i\u1ec1u l\u1ec7" })],
                [factOf({ id: "c2", sourceIds: ["s2"] })],
            ),
            dossierOf(
                "11",
                "Ch\u1ee9ng t\u1eeb g\u00f3p v\u1ed1n",
                [docOf({ id: "s11", title: "11. Sao k\u00ea ng\u00e2n h\u00e0ng" })],
                [
                    factOf({ id: "c11", value: bankCapital, sourceIds: ["s11"] }),
                    factOf({
                        id: "g11",
                        attribute: "von-thuc-gop",
                        attributeLabel: "V\u1ed1n th\u1ef1c g\u00f3p",
                        value: contributed,
                        sourceIds: ["s11"],
                    }),
                ],
            ),
        ])

    it("finds a high contradiction filed under the charter relating the others, and the overdue shortfall as critical", async () => {
        const subject = await buildSubject()
        const found = subject
            .runRules(passOf("285.000.000", "182.000.000"))
            .candidates.filter((item) => item.ruleKey.startsWith("amounts."))

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "amounts.invariant",
                dossierId: "d2",
                relatedDossierIds: ["d1", "d11"],
                kind: "contradiction",
                severity: "high",
                params: { invariant: "V\u1ed1n \u0111i\u1ec1u l\u1ec7", values: "300.000.000; 285.000.000" },
            }),
            expect.objectContaining({
                ruleKey: "amounts.contribution",
                dossierId: "d11",
                kind: "unreasonable",
                severity: "critical",
                params: { contributed: "182.000.000", capital: "300.000.000", deadline: "09/04/2026" },
            }),
        ])
    })

    it("finds nothing when the amounts agree and the capital is contributed in full", async () => {
        const subject = await buildSubject()
        const found = subject
            .runRules(passOf("300.000.000", "300.000.000"))
            .candidates.filter((item) => item.ruleKey.startsWith("amounts."))

        expect(found).toEqual([])
    })
})

describe("acceptance A3: the legal representative's file holds no CCCD of the legal representative", () => {
    const representative = factOf({
        id: "l1",
        attribute: "nguoi-dai-dien-theo-phap-luat",
        attributeLabel: "Ng\u01b0\u1eddi \u0111\u1ea1i di\u1ec7n theo ph\u00e1p lu\u1eadt",
        value: "Nguy\u1ec5n V\u0103n A",
        validFrom: "2026-08-20",
        sourceIds: ["s1"],
    })
    const passOf = (title: string): ReviewContext =>
        contextOf([
            dossierOf(
                "1",
                "Gi\u1ea5y ch\u1ee9ng nh\u1eadn \u0110KDN",
                [docOf({ id: "s1", title: "01. GCN \u0110KDN l\u1ea7n 2" })],
                [representative],
            ),
            dossierOf(
                "6",
                "H\u1ed3 s\u01a1 ng\u01b0\u1eddi \u0111\u1ea1i di\u1ec7n theo ph\u00e1p lu\u1eadt",
                [docOf({ id: "s6", title })],
                [],
            ),
        ])

    it("finds the CCCD of the current legal representative missing", async () => {
        const subject = await buildSubject()
        const found = subject
            .runRules(passOf("06. Ph\u00e2n c\u00f4ng nhi\u1ec7m v\u1ee5"))
            .candidates.filter((item) => item.dossierId === "d6")

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "presence.expected",
                kind: "missing",
                severity: "medium",
                code: "presence_expected_holder",
                subject: "legal_representative_id:nguyen van a",
                remedyAction: "upload",
            }),
        ])
        expect(found[0]?.params.holder).toBe("Nguy\u1ec5n V\u0103n A")
    })

    it("finds nothing once the CCCD naming the legal representative is held", async () => {
        const subject = await buildSubject()
        const found = subject
            .runRules(passOf("06. CCCD Nguy\u1ec5n V\u0103n A"))
            .candidates.filter((item) => item.dossierId === "d6")

        expect(found).toEqual([])
    })
})

describe("acceptance A4: two people hold the accountant role at the same time", () => {
    const passOf = (formerEnds: string | null): ReviewContext =>
        contextOf([
            dossierOf(
                "5",
                "T\u00e0i kho\u1ea3n ng\u00e2n h\u00e0ng - S\u1ed5 theo d\u00f5i",
                [docOf({ id: "s5", title: "05. T\u00e0i kho\u1ea3n ng\u00e2n h\u00e0ng BIDV", date: "2026-01-15" })],
                [
                    factOf({
                        id: "a5",
                        subjectKey: "bidv",
                        subject: "BIDV",
                        attribute: "nguoi-phu-trach-ke-toan",
                        attributeLabel: "Ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch k\u1ebf to\u00e1n",
                        value: "Nguy\u1ec5n V\u0103n B",
                        validTo: formerEnds,
                        sourceIds: ["s5"],
                    }),
                ],
            ),
            dossierOf(
                "23",
                "Quy\u1ebft \u0111\u1ecbnh b\u1ed5 nhi\u1ec7m Gi\u00e1m \u0111\u1ed1c",
                [
                    docOf({
                        id: "s23",
                        title: "23. Quy\u1ebft \u0111\u1ecbnh b\u1ed5 nhi\u1ec7m 04",
                        date: "2026-08-20",
                    }),
                ],
                [
                    factOf({
                        id: "a23",
                        attribute: "nguoi-phu-trach-ke-toan",
                        attributeLabel: "Ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch k\u1ebf to\u00e1n",
                        value: "Nguy\u1ec5n V\u0103n C",
                        validFrom: "2026-08-20",
                        sourceIds: ["s23"],
                    }),
                ],
            ),
        ])

    it("finds a high contradiction filed under the bank that still names the former accountant", async () => {
        const subject = await buildSubject()
        const found = subject.runRules(passOf(null)).candidates.filter((item) => item.ruleKey === "roles.holders")

        expect(found).toEqual([
            expect.objectContaining({
                dossierId: "d5",
                relatedDossierIds: ["d23"],
                kind: "contradiction",
                severity: "high",
                subject: "accountant:nguyen van b,nguyen van c",
                params: {
                    role: "Ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch k\u1ebf to\u00e1n",
                    holders: "Nguy\u1ec5n V\u0103n B, Nguy\u1ec5n V\u0103n C",
                },
            }),
        ])
        expect(found[0]?.evidence.map((item) => [item.factId, item.role])).toEqual([
            ["a5", "claim"],
            ["a23", "counter"],
        ])
    })

    it("finds nothing when the former accountant's role ended before the new one began", async () => {
        const subject = await buildSubject()

        expect(
            subject.runRules(passOf("2026-08-19")).candidates.filter((item) => item.ruleKey === "roles.holders"),
        ).toEqual([])
    })
})

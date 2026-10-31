import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, DossierRef, ReviewContext } from "./dossier-inputs.contracts"
import { PACK } from "./dossier-pack.policy"
import { signatureRules } from "./signatures.policy"

const SUBJECT = Symbol("signatures.policy")
type Subject = { signatureRules: typeof signatureRules }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { signatureRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const dossierOf = builder<DossierRef>({
    id: "d2",
    ref: "2",
    name: "Dieu le cong ty",
    category: "PHAP LY",
    position: 2,
    checklistStatus: "present",
    existing: null,
    missing: null,
    drafts: null,
})
const docOf = builder<DocumentInput>({
    id: "s1",
    title: "02. Ban ghi",
    tags: [],
    origin: null,
    state: "actual",
    date: null,
    updatedAt: "2026-10-01T00:00:00.000Z",
    chunkCount: 0,
    passages: [],
})
const inputsOf = builder<DossierInputs>({
    dossier: dossierOf(),
    entry: PACK.get("2") ?? null,
    documents: [],
    facts: [],
})
const contextOf = builder<ReviewContext>({ today: "2026-10-31", dossiers: [], activeFacts: [] })

describe("signatures.unsigned", () => {
    it("files a charter held only as a draft awaiting signature", async () => {
        const subject = await buildSubject()
        const draft = docOf({ id: "s2", title: "02. Du thao dieu le cho ky", state: "draft" })
        const label = PACK.get("2")?.expects[0]?.label
        expect(subject.signatureRules(contextOf({ dossiers: [inputsOf({ documents: [draft] })] }))).toEqual([
            expect.objectContaining({
                ruleKey: "signatures.unsigned",
                dossierId: "d2",
                kind: "unsigned",
                severity: "high",
                code: "signatures_unsigned",
                params: { dossier: "2. Dieu le cong ty", expectation: label },
                evidence: [
                    expect.objectContaining({ role: "claim", sourceId: "s2", label }),
                    expect.objectContaining({ role: "expected", sourceId: null, label }),
                ],
                remedyAction: "upload",
                subject: "charter",
            }),
        ])
    })

    it("files nothing for a signed copy, for no matching document, for an expectation that need not be signed or outside the pack", async () => {
        const subject = await buildSubject()
        const signed = docOf({ id: "s3", title: "02. Dieu le" })
        const draft = docOf({ id: "s2", title: "02. Du thao dieu le", state: "draft" })
        const representative = inputsOf({
            dossier: dossierOf({ id: "d6", ref: "6", name: "Nguoi dai dien" }),
            entry: PACK.get("6") ?? null,
            documents: [docOf({ id: "s6", title: "06. CCCD", state: "draft" })],
        })
        const context = contextOf({
            dossiers: [
                inputsOf({ documents: [signed, draft] }),
                inputsOf({ dossier: dossierOf({ id: "d3" }), documents: [docOf({ id: "s4", title: "02. Bien ban" })] }),
                representative,
                inputsOf({ dossier: dossierOf({ id: "d9" }), entry: null, documents: [draft] }),
            ],
        })
        expect(subject.signatureRules(context)).toEqual([])
    })
})

describe("signatures.placeholders", () => {
    it("counts the blanks of actual documents and drafts and quotes the first verbatim", async () => {
        const subject = await buildSubject()
        const actual = docOf({
            id: "s5",
            title: "02. Dieu le",
            passages: [
                { id: "p1", order: 0, text: "Ngay ky: ...... tai Ha Noi, ty le [65]% von" },
                { id: "p2", order: 1, text: "Khong co cho trong" },
            ],
        })
        const draft = docOf({
            id: "s6",
            title: "02. Du thao",
            state: "draft",
            passages: [{ id: "p3", order: 0, text: "Ben B: [ ] dai dien …… va [__] [...]" }],
        })
        const template = docOf({
            id: "s7",
            state: "template",
            passages: [{ id: "p4", order: 0, text: "Mau: ........" }],
        })
        const [finding, ...rest] = subject.signatureRules(
            contextOf({ dossiers: [inputsOf({ entry: null, documents: [actual, draft, template] })] }),
        )
        expect(rest).toEqual([])
        expect(finding).toEqual(
            expect.objectContaining({
                ruleKey: "signatures.placeholders",
                kind: "missing",
                severity: "low",
                code: "signatures_placeholders",
                params: {
                    dossier: "2. Dieu le cong ty",
                    count: "6",
                    quote: "Ngay ky: ...... tai Ha Noi, ty le [65]% von",
                },
                remedyAction: "decide",
                subject: "placeholders",
            }),
        )
        expect(finding?.evidence.map((item) => [item.passageId, item.quote])).toEqual([
            ["p1", "Ngay ky: ...... tai Ha Noi, ty le [65]% von"],
            ["p3", "Ben B: [ ] dai dien …… va [__] [...]"],
        ])
    })

    it("files nothing when no blank is left", async () => {
        const subject = await buildSubject()
        const clean = docOf({ passages: [{ id: "p1", order: 0, text: "Da ky ngay 17/08/2026" }] })
        expect(
            subject.signatureRules(contextOf({ dossiers: [inputsOf({ entry: null, documents: [clean] })] })),
        ).toEqual([])
    })
})

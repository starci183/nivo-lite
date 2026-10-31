import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DocumentInput, DossierInputs, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import { factConflictRules } from "./facts-conflict.policy"

const SUBJECT = Symbol("facts-conflict.policy")
type Subject = { factConflictRules: typeof factConflictRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { factConflictRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const factOf = builder<ReviewFact>({
    id: "f1",
    subjectKey: "cong-ty-tnhh-mau",
    subject: "Cong ty TNHH Mau",
    attribute: "dia-chi",
    attributeLabel: "Dia chi",
    value: "So 1",
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
    date: "2026-08-01",
    updatedAt: "2026-08-01T00:00:00.000Z",
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

const contextOf = (dossiers: ReadonlyArray<DossierInputs>): ReviewContext => ({
    today: "2026-10-31",
    dossiers,
    activeFacts: [],
})

describe("factConflictRules", () => {
    it("files each conflicting pair of document facts once, under the dossier of the first", async () => {
        const subject = await buildSubject()
        const first = factOf({ id: "f1", conflictWith: "f2", value: "So 1" })
        const second = factOf({ id: "f2", conflictWith: "f1", value: "So 2", sourceIds: ["s5"] })
        const context = contextOf([dossierOf("1", [docOf()], [first]), dossierOf("5", [docOf({ id: "s5" })], [second])])

        const found = subject.factConflictRules(context)

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "facts.conflict",
                dossierId: "d1",
                relatedDossierIds: ["d5"],
                kind: "contradiction",
                severity: "medium",
                code: "facts_conflict",
                subject: "f1,f2",
                params: { subject: "Cong ty TNHH Mau", attribute: "Dia chi", first: "So 1", second: "So 2" },
                remedyAction: "decide",
            }),
        ])
        expect(found[0]?.evidence.map((item) => [item.factId, item.role])).toEqual([
            ["f1", "claim"],
            ["f2", "counter"],
        ])
    })

    it("relates nothing when the other fact files nowhere, and skips a conflict outside the pass or a fact filed nowhere", async () => {
        const subject = await buildSubject()
        const context = contextOf([
            dossierOf(
                "1",
                [docOf()],
                [
                    factOf({ id: "f1", conflictWith: "f2" }),
                    factOf({ id: "f2", sourceIds: ["gone"] }),
                    factOf({ id: "f3", conflictWith: "missing" }),
                    factOf({ id: "f4", conflictWith: "f1", sourceIds: ["gone"] }),
                    factOf({ id: "f5" }),
                ],
            ),
        ])

        expect(subject.factConflictRules(context)).toEqual([
            expect.objectContaining({ subject: "f1,f2", relatedDossierIds: [] }),
        ])
    })
})

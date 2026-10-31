import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { citationRules } from "./citations.policy"
import type { DocumentInput, DossierInputs, ReviewContext } from "./dossier-inputs.contracts"

const SUBJECT = Symbol("citations.policy")
type Subject = { citationRules: typeof citationRules }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { citationRules } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const docOf = builder<DocumentInput>({
    id: "s1",
    title: "Quy che",
    tags: [],
    origin: null,
    state: "actual",
    date: "2026-08-01",
    updatedAt: "2026-08-01T00:00:00.000Z",
    chunkCount: 1,
    passages: [],
})

const contextOf = (docs: ReadonlyArray<DocumentInput>): ReviewContext => ({
    today: "2026-10-31",
    dossiers: [
        {
            dossier: {
                id: "d44",
                ref: "44",
                name: "Chung tu ke toan",
                category: "FINANCE",
                position: 44,
                checklistStatus: "present",
                existing: null,
                missing: null,
                drafts: null,
            },
            entry: null,
            documents: docs,
            facts: [],
        } satisfies DossierInputs,
    ],
    activeFacts: [],
})

const passage = (id: string, text: string) => ({ id, order: 0, text })

/** "Can cu Nghi dinh 123/2020/ND-CP ve hoa don" with its Vietnamese marks. */
const CITING = "C\u0103n c\u1ee9 Ngh\u1ecb \u0111\u1ecbnh 123/2020/N\u0110-CP v\u1ec1 h\u00f3a \u0111\u01a1n"

describe("citationRules", () => {
    it("finds a document dated after a text ended that still cites it, quoting the citation verbatim", async () => {
        const subject = await buildSubject()
        const doc = docOf({ passages: [passage("p1", CITING), passage("p2", "Nothing cited here")] })

        const found = subject.citationRules(contextOf([doc]))

        expect(found).toEqual([
            expect.objectContaining({
                ruleKey: "citations.repealed",
                dossierId: "d44",
                kind: "outdated",
                severity: "medium",
                code: "citations_repealed",
                subject: "nd_123_2020",
                params: { citation: "ND 123/2020", replacement: "ND 254/2026", since: "01/07/2026" },
                remedyAction: "decide",
            }),
        ])
        expect(found[0]?.evidence).toEqual([
            {
                role: "claim",
                label: "Quy che",
                sourceId: "s1",
                sourceTitle: "Quy che",
                passageId: "p1",
                factId: null,
                factLine: null,
                quote: CITING,
            },
        ])
    })

    it("finds nothing in a document dated before the end, an undated one or a template", async () => {
        const subject = await buildSubject()
        const cites = [passage("p1", "Thong tu 132/2018/TT-BTC")]
        const docs = [
            docOf({ id: "s1", date: "2026-06-30", passages: cites }),
            docOf({ id: "s2", date: null, passages: cites }),
            docOf({ id: "s3", state: "template", passages: cites }),
        ]

        expect(subject.citationRules(contextOf(docs))).toEqual([])
    })
})

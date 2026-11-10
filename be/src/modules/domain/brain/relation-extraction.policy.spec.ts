import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { RELATIONS_PROMPT, parseRelations as realParseRelations, relationsPrompt as realRelationsPrompt } from "./relation-extraction.policy"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi-ship-noi-thanh",
    attributeLabel: "phi ship noi thanh",
    value: "30.000 d",
    valueNumber: null,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Quy dinh giao hang.docx",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const FACTS = [
    factOf({ id: "ship" }),
    factOf({ id: "express", attributeLabel: "giao hoa toc", value: "noi thanh" }),
    factOf({ id: "pay", subjectLabel: "Thanh toan", attributeLabel: "cach", value: "chuyen khoan MB" }),
]

/** The scripted answer of the relation pass: no model is called in a spec. */
const SCRIPTED = {
    relations: [
        { from: 2, to: 1, kind: "part_of", label: "giao bang" },
        { from: 1, to: 2, kind: "related" },
        { from: 3, to: 3, kind: "related" },
        { from: 1, to: 9, kind: "related" },
        { from: 3, to: 1, kind: "owns" },
    ],
}


const SUBJECT = Symbol("relation-extraction.policy")



describe("relation-extraction.policy as a Nest value", () => {
    let parseRelations: typeof realParseRelations
    let relationsPrompt: typeof realRelationsPrompt

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: { parseRelations: realParseRelations, relationsPrompt: realRelationsPrompt } }],
        }).compile()
        const subject = moduleRef.get<{ parseRelations: typeof realParseRelations; relationsPrompt: typeof realRelationsPrompt }>(SUBJECT)
        parseRelations = subject.parseRelations
        relationsPrompt = subject.relationsPrompt
    })

    describe("relation-extraction.policy", () => {
        it("numbers the facts from 1 in one line each", () => {
            expect(relationsPrompt(FACTS)).toBe(
                [
                    "FACTS:",
                    "1. Giao hang - phi ship noi thanh: 30.000 d",
                    "2. Giao hang - giao hoa toc: noi thanh",
                    "3. Thanh toan - cach: chuyen khoan MB",
                ].join("\n"),
            )
            expect(RELATIONS_PROMPT).toContain('"relations"')
        })

        it("keeps the edges between listed facts once per pair, with a known kind, and drops the rest", () => {
            expect(parseRelations(SCRIPTED, FACTS)).toEqual([
                { fromFactId: "express", toFactId: "ship", kind: "part_of", label: "giao bang", createdBy: "NIVO" },
            ])
        })

        it("answers null for an answer with no relations list", () => {
            expect(parseRelations({ facts: [] }, FACTS)).toBeNull()
            expect(parseRelations(null, FACTS)).toBeNull()
        })
    })
})

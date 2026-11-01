import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "./brain-facts.contracts"
import { batchIdOf, bulkNoteOf, bulkTagOf, isBulkSafe } from "./bulk-apply.policy"

const SUBJECT = Symbol("bulk-apply.policy")
const NOW = Date.parse("2026-10-12T10:00:00.000Z")

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
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
    evidence: [{ kind: "document", ref: "s1", label: "Rules", quote: "Open from 8 to 21", sourceId: "s1" }],
    proposedBy: "Rules",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { batchIdOf, bulkNoteOf, bulkTagOf, isBulkSafe } }],
    }).compile()
    return moduleRef.get<{
        batchIdOf: typeof batchIdOf
        bulkNoteOf: typeof bulkNoteOf
        bulkTagOf: typeof bulkTagOf
        isBulkSafe: typeof isBulkSafe
    }>(SUBJECT)
}

describe("isBulkSafe", () => {
    it("accepts an internal value from a document that quotes it, with nothing in force to disagree with", async () => {
        const subject = await build()

        expect(subject.isBulkSafe(factOf(), NOW)).toBe(true)
        expect(subject.isBulkSafe(factOf({ validFrom: "2026-10-01T00:00:00.000Z" }), NOW)).toBe(true)
    })

    it.each<[string, Partial<FactRecord>]>([
        ["a public fact: a bulk path never makes anything public", { scope: "public" }],
        ["a restricted fact", { scope: "restricted", modules: ["sales"] }],
        ["a proposal to stop using a value", { proposalKind: "retire" }],
        ["a value that disagrees with the one in force", { conflictWith: "f0" }],
        ["a value that starts later", { validFrom: "2026-11-01T00:00:00.000Z" }],
        ["a fact already decided", { status: "active" }],
        ["a fact from a customer", { sourceKind: "customer" }],
        ["a fact the document does not quote", { evidence: [{ kind: "document", ref: "s1", label: "Rules" }] }],
        [
            "a fact whose quote is too short to be the document's words",
            { evidence: [{ kind: "document", ref: "s1", label: "Rules", quote: "8-21" }] },
        ],
        [
            "a fact whose only quote is not from a document",
            { evidence: [{ kind: "note", ref: "n", label: "Note", quote: "Open from 8 to 21" }] },
        ],
    ])("leaves %s for a person", async (_name, patch) => {
        const subject = await build()

        expect(subject.isBulkSafe(factOf(patch), NOW)).toBe(false)
    })
})

describe("the note of a batch", () => {
    it("names the batch so its facts are found again, and a plain note names none", async () => {
        const subject = await build()
        const note = subject.bulkNoteOf("b-1", "Rules")

        expect(note.startsWith(subject.bulkTagOf("b-1"))).toBe(true)
        expect(subject.batchIdOf(note)).toBe("b-1")
        expect(subject.batchIdOf("Chosen among several different values")).toBeNull()
        expect(subject.batchIdOf(null)).toBeNull()
        expect(subject.batchIdOf("bulk: ")).toBeNull()
    })

    it("keeps a long title from filling the note", async () => {
        const subject = await build()

        expect(subject.bulkNoteOf("b-1", "x".repeat(300)).length).toBeLessThan(200)
    })
})

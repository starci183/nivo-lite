import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DRAFT_READ_SCHEMA } from "./draft.schema"
import { MAX_BODY_CHARS } from "./public-documents.contracts"

const SUBJECT = Symbol("draft.schema")
interface Subject {
    readonly schema: typeof DRAFT_READ_SCHEMA
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ schema: DRAFT_READ_SCHEMA }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("DRAFT_READ_SCHEMA", () => {
    it("takes a text that answers, and an answer that says the documents do not answer", async () => {
        const subject = await buildSubject()

        expect(subject.schema.safeParse({ answers: true, body: "Bikes serviced in a day." }).success).toBe(true)
        expect(subject.schema.safeParse({ answers: false, body: "" }).success).toBe(true)
    })

    it.each([
        {},
        { answers: true },
        { body: "x" },
        { answers: "yes", body: "x" },
        { answers: true, body: "x".repeat(MAX_BODY_CHARS + 1) },
        { usable: [1], excluded: [], paragraphs: [] },
    ])("refuses %j as unreadable", async (answer) => {
        const subject = await buildSubject()

        expect(subject.schema.safeParse(answer).success).toBe(false)
    })
})

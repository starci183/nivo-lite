import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DRAFT_OUTPUT_SCHEMA } from "./draft-answer.policy"

const SUBJECT = Symbol("draft-answer.policy")
interface Subject {
    readonly schema: typeof DRAFT_OUTPUT_SCHEMA
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ schema: DRAFT_OUTPUT_SCHEMA }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("DRAFT_OUTPUT_SCHEMA", () => {
    it("is one closed object of exactly `answers` then `body`, both required", async () => {
        const subject = await buildSubject()

        expect(subject.schema).toEqual({
            type: "object",
            properties: { answers: { type: "boolean" }, body: { type: "string" } },
            required: ["answers", "body"],
            additionalProperties: false,
        })
        expect(JSON.stringify(subject.schema).indexOf("answers")).toBeLessThan(JSON.stringify(subject.schema).indexOf("body"))
    })

    it("carries no length or number bound and no line-level field", async () => {
        const subject = await buildSubject()

        expect(JSON.stringify(subject.schema)).not.toMatch(/min|max|pattern|usable|excluded|reason|lines/u)
    })
})

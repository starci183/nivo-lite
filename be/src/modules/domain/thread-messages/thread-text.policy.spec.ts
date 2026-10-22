import { Test } from "@nestjs/testing"
import { stepTitleOf } from "./thread-text.policy"

const SUBJECT = Symbol("thread-text.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { stepTitleOf } }],
    }).compile()
    return moduleRef.get<typeof import("./thread-text.policy")>(SUBJECT)
}

describe("thread text policy", () => {
    it("takes the explicit title when there is one", async () => {
        const subject = await buildSubject()

        expect(subject.stepTitleOf("  Check invoice  ", "anything")).toBe("Check invoice")
    })

    it("takes the first line of the text when no title is given", async () => {
        const subject = await buildSubject()

        expect(subject.stepTitleOf(null, "Tax id does not match the file.\n@Van please check.")).toBe(
            "Tax id does not match the file.",
        )
    })

    it("takes a one-line text whole when no title is given", async () => {
        const subject = await buildSubject()

        expect(subject.stepTitleOf(null, "  Send the confirmation  ")).toBe("Send the confirmation")
    })

    it("cuts a long title to eighty characters with three dots", async () => {
        const subject = await buildSubject()

        const title = subject.stepTitleOf(null, "word ".repeat(40))

        expect(title).toHaveLength(80)
        expect(title.endsWith("...")).toBe(true)
    })

    it("keeps a title of exactly eighty characters whole", async () => {
        const subject = await buildSubject()

        expect(subject.stepTitleOf("x".repeat(80), "")).toBe("x".repeat(80))
    })
})

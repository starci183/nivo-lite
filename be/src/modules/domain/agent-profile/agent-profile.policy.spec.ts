import { Test } from "@nestjs/testing"
import { isAssignableText, requestTextOf, threadTitleOf } from "./agent-profile.policy"

type Subject = {
    isAssignableText: typeof isAssignableText
    requestTextOf: typeof requestTextOf
    threadTitleOf: typeof threadTitleOf
}

const SUBJECT = Symbol("agent-profile.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isAssignableText, requestTextOf, threadTitleOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("requestTextOf", () => {
    it("trims the request", async () => {
        const subject = await buildSubject()

        expect(subject.requestTextOf("  close the group booking \n")).toBe("close the group booking")
    })
})

describe("isAssignableText", () => {
    it("accepts a request of one to 2000 characters", async () => {
        const subject = await buildSubject()

        expect(subject.isAssignableText("a")).toBe(true)
        expect(subject.isAssignableText("a".repeat(2000))).toBe(true)
    })

    it("refuses an empty one and one over the limit", async () => {
        const subject = await buildSubject()

        expect(subject.isAssignableText("")).toBe(false)
        expect(subject.isAssignableText("a".repeat(2001))).toBe(false)
    })
})

describe("threadTitleOf", () => {
    it("takes the first line of the request", async () => {
        const subject = await buildSubject()

        expect(subject.threadTitleOf("Close the group booking\n8 percent off if needed")).toBe(
            "Close the group booking",
        )
    })

    it("keeps a title of exactly 80 characters whole", async () => {
        const subject = await buildSubject()
        const title = "x".repeat(80)

        expect(subject.threadTitleOf(title)).toBe(title)
    })

    it("clips a longer first line to 80 characters with an ellipsis", async () => {
        const subject = await buildSubject()

        const title = subject.threadTitleOf("y".repeat(120))

        expect(title).toHaveLength(80)
        expect(title.endsWith(String.fromCodePoint(0x2026))).toBe(true)
    })

    it("answers an empty title for an empty text", async () => {
        const subject = await buildSubject()

        expect(subject.threadTitleOf("")).toBe("")
    })
})

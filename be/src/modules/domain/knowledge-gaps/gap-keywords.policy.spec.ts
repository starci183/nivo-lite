import { Test } from "@nestjs/testing"
import { splitTopic } from "./gap-keywords.policy"

const SUBJECT = Symbol("gap-keywords.policy")
type Subject = Pick<typeof import("./gap-keywords.policy"), "splitTopic">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { splitTopic },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("gap keywords policy", () => {
    it("splits the first two trimmed topic parts and defaults missing parts to null", async () => {
        const subject = await buildSubject()

        expect(subject.splitTopic(undefined)).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(null)).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(" | ")).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(" Tea ")).toEqual({ subject: "Tea", attribute: null })
        expect(subject.splitTopic(" Tea | Price | ignored ")).toEqual({ subject: "Tea", attribute: "Price" })
        expect(subject.splitTopic(`${"s".repeat(121)} | ${"a".repeat(121)}`)).toEqual({
            subject: "s".repeat(120),
            attribute: "a".repeat(120),
        })
    })
})

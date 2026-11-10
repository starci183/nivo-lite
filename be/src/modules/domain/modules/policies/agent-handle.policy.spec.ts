import { Test } from "@nestjs/testing"
import { handleBaseOf as realHandleBaseOf } from "./agent-handle.policy"

const SUBJECT = Symbol("agent-handle.policy")
type Subject = { handleBaseOf: typeof realHandleBaseOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { handleBaseOf: realHandleBaseOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("agent handle policy", () => {
    it("puts the name after the role handle", async () => {
        const subject = await buildSubject()

        expect(subject.handleBaseOf("Lan", "sales")).toBe("sales-lan")
        expect(subject.handleBaseOf("Minh Anh", "sales")).toBe("sales-minh-anh")
    })

    it("keeps a name that already starts with the role", async () => {
        const subject = await buildSubject()

        expect(subject.handleBaseOf("Sales Lan", "sales")).toBe("sales-lan")
        expect(subject.handleBaseOf("Sales", "sales")).toBe("sales")
    })

    it("falls back to the role handle when the name gives no handle", async () => {
        const subject = await buildSubject()

        expect(subject.handleBaseOf(null, "sales")).toBe("sales")
        expect(subject.handleBaseOf(undefined, "chatbot")).toBe("chatbot")
        expect(subject.handleBaseOf("!!", "sales")).toBe("sales")
    })

    it("clips a long name to the handle limit without a trailing hyphen", async () => {
        const subject = await buildSubject()

        const base = subject.handleBaseOf("a very long name for the newest sales agent", "sales")

        expect(base.length).toBeLessThanOrEqual(32)
        expect(base.startsWith("sales-a-very")).toBe(true)
        expect(base.endsWith("-")).toBe(false)
    })
})

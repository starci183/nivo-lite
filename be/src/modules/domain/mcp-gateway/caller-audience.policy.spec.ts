import { Test } from "@nestjs/testing"
import { audienceOfModule } from "./caller-audience.policy"

/** The members of the subject under test. */
interface Subject {
    readonly audienceOfModule: typeof audienceOfModule
}

const SUBJECT = Symbol("caller-audience.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { audienceOfModule } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("caller-audience.policy", () => {
    it("is internal for a staff-facing module of the catalogue", async () => {
        const subject = await build()

        expect(subject.audienceOfModule("sales")).toBe("internal")
        expect(subject.audienceOfModule("accounting")).toBe("internal")
    })

    it("is customer for a customer-facing module, a publishing one, an unknown one and no module", async () => {
        const subject = await build()

        expect(subject.audienceOfModule("chatbot")).toBe("customer")
        expect(subject.audienceOfModule("content")).toBe("customer")
        expect(subject.audienceOfModule("video")).toBe("customer")
        expect(subject.audienceOfModule("gone")).toBe("customer")
        expect(subject.audienceOfModule(null)).toBe("customer")
    })
})

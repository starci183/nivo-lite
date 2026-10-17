import { Test } from "@nestjs/testing"
import { bearerTokenOf as realBearerTokenOf } from "./tool-bearer.policy"

const SUBJECT = Symbol("tool-bearer.policy")
type Subject = {
    bearerTokenOf: typeof realBearerTokenOf
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bearerTokenOf: realBearerTokenOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("bearerTokenOf", () => {
    it("takes the token after the Bearer scheme in any case", async () => {
        const subject = await build()
        expect(subject.bearerTokenOf("Bearer abc.def")).toBe("abc.def")
        expect(subject.bearerTokenOf("bearer   xyz  ")).toBe("xyz")
    })

    it("answers an empty text for a missing header or another scheme", async () => {
        const subject = await build()
        expect(subject.bearerTokenOf(undefined)).toBe("")
        expect(subject.bearerTokenOf("Basic abc")).toBe("")
        expect(subject.bearerTokenOf("Bearer")).toBe("")
    })
})

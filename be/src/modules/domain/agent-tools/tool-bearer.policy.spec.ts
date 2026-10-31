import { Test } from "@nestjs/testing"
import { bearerTokenOf as realBearerTokenOf, isBridgeToken as realIsBridgeToken } from "./tool-bearer.policy"

const SUBJECT = Symbol("tool-bearer.policy")
type Subject = {
    bearerTokenOf: typeof realBearerTokenOf
    isBridgeToken: typeof realIsBridgeToken
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    bearerTokenOf: realBearerTokenOf,
                    isBridgeToken: realIsBridgeToken,
                },
            },
        ],
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

describe("bridge tokens", () => {
    it("tells the signed credential of the bridge plugin from a per-job token", async () => {
        const subject = await build()
        expect(subject.isBridgeToken("bridge.body.mac")).toBe(true)
        expect(subject.isBridgeToken("body.mac")).toBe(false)
        expect(subject.isBridgeToken("")).toBe(false)
    })
})

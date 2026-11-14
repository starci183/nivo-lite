import { Test } from "@nestjs/testing"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { CreatomateError, CreatomateErrorCode } from "@modules/integrations/creatomate"
import { creatomateFailureOf } from "./creatomate-failure.policy"

const SUBJECT = Symbol("creatomate-failure.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { creatomateFailureOf } }],
    }).compile()
    return moduleRef.get<typeof import("./creatomate-failure.policy")>(SUBJECT)
}

const failed = (code: CreatomateErrorCode, detail = "") => new CreatomateError({ code, params: { status: 0, detail } })

describe("creatomateFailureOf", () => {
    it.each([
        [CreatomateErrorCode.AuthFailed, "auth_refused"],
        [CreatomateErrorCode.NotFound, "not_found"],
        [CreatomateErrorCode.Rejected, "rejected"],
    ] as const)("types %s as a refusal %s proved not_sent, with the hint as its words", async (code, reason) => {
        const subject = await build()
        const out = subject.creatomateFailureOf(failed(code, "the hint"))

        expect(providerRefusalReason(out)).toBe(reason)
        expect(out).toMatchObject({ params: { provider: "creatomate", detail: "the hint" } })
        expect(providerRefusalDetail(out)).toBe("the hint")
        expect(proofOf(out)).toBe("not_sent")
    })

    it("rethrows a rate limit as it is, proved not_sent", async () => {
        const subject = await build()
        const cause = failed(CreatomateErrorCode.RateLimited)

        expect(subject.creatomateFailureOf(cause)).toBe(cause)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it.each([CreatomateErrorCode.Unreachable, CreatomateErrorCode.Failed, CreatomateErrorCode.Malformed])("proves %s unknown", async (code) => {
        const subject = await build()
        const cause = failed(code)

        expect(subject.creatomateFailureOf(cause)).toBe(cause)
        expect(proofOf(cause)).toBe("unknown")
    })

    it("leaves a foreign error alone", async () => {
        const subject = await build()
        const cause = new Error("x")

        expect(subject.creatomateFailureOf(cause)).toBe(cause)
    })
})

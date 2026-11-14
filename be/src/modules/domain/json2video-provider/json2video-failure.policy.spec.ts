import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { Json2videoError, Json2videoErrorCode } from "@modules/integrations/json2video"
import { JSON2VIDEO_PROVIDER as JSON2VIDEO_PROVIDERSubject, json2videoFailureOf as json2videoFailureOfSubject } from "./json2video-failure.policy"

const SUBJECT = Symbol("json2video-failure.policy")

const build = async (): Promise<{ JSON2VIDEO_PROVIDER: typeof JSON2VIDEO_PROVIDERSubject; json2videoFailureOf: typeof json2videoFailureOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ JSON2VIDEO_PROVIDER: typeof JSON2VIDEO_PROVIDERSubject; json2videoFailureOf: typeof json2videoFailureOfSubject }>({ JSON2VIDEO_PROVIDER: JSON2VIDEO_PROVIDERSubject, json2videoFailureOf: json2videoFailureOfSubject }) }],
    }).compile()
    return moduleRef.get<{ JSON2VIDEO_PROVIDER: typeof JSON2VIDEO_PROVIDERSubject; json2videoFailureOf: typeof json2videoFailureOfSubject }>(SUBJECT)
}

const failed = (code: Json2videoErrorCode, detail: string = ""): Json2videoError =>
    new Json2videoError({ code, params: { status: 0, word: "", detail } })

describe("json2videoFailureOf", () => {
    let JSON2VIDEO_PROVIDER: typeof JSON2VIDEO_PROVIDERSubject
    let json2videoFailureOf: typeof json2videoFailureOfSubject

    beforeAll(async () => {
        ;({ JSON2VIDEO_PROVIDER, json2videoFailureOf } = await build())
    })

    it.each([
        [Json2videoErrorCode.AuthFailed, "auth_refused"],
        [Json2videoErrorCode.NotFound, "not_found"],
        [Json2videoErrorCode.Rejected, "rejected"],
    ] as const)("types %s as a refusal %s proved not_sent, with the provider's words", (code, reason) => {
        const out = json2videoFailureOf(failed(code, "their words"))

        // A refusal is a DomainError (`ProviderRegistryError`: the reason is its code, provider and words ride in `params`), not an
        // object with `reason` / `provider` / `detail` members; read through the registry's own readers (one error base, DomainError only).
        expect(providerRefusalReason(out)).toBe(reason)
        expect(out).toMatchObject({ params: { provider: JSON2VIDEO_PROVIDER, detail: "their words" } })
        expect(providerRefusalDetail(out)).toBe("their words")
        expect(proofOf(out)).toBe("not_sent")
    })

    it("carries no detail when the provider said nothing", () => {
        const out = json2videoFailureOf(failed(Json2videoErrorCode.Rejected))

        expect(providerRefusalReason(out)).toBe("rejected")
        expect(providerRefusalDetail(out)).toBeNull()
        expect(out).not.toHaveProperty("params.detail")
    })

    it("rethrows a rate limit as it is, proved not_sent (the tool runner falls back to the next account)", () => {
        const cause = failed(Json2videoErrorCode.RateLimited)

        expect(json2videoFailureOf(cause)).toBe(cause)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it.each([Json2videoErrorCode.Unreachable, Json2videoErrorCode.Failed, Json2videoErrorCode.Malformed])("proves %s unknown", (code) => {
        expect(proofOf(json2videoFailureOf(failed(code)))).toBe("unknown")
    })

    it("proves nothing of a foreign failure", () => {
        const cause = new Error("x")

        expect(json2videoFailureOf(cause)).toBe(cause)
        expect(proofOf(cause)).toBeNull()
    })
})

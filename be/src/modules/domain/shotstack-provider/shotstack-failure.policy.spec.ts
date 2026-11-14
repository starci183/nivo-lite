import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ShotstackError, ShotstackErrorCode } from "@modules/integrations/shotstack"
import { shotstackFailureOf as shotstackFailureOfSubject } from "./shotstack-failure.policy"

const SUBJECT = Symbol("shotstack-failure.policy")

describe("shotstack-failure.policy built the way Nest does", () => {
    let shotstackFailureOf: typeof shotstackFailureOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ shotstackFailureOf: typeof shotstackFailureOfSubject }>({ shotstackFailureOf: shotstackFailureOfSubject }) }],
        }).compile()
        ;({ shotstackFailureOf } = moduleRef.get<{ shotstackFailureOf: typeof shotstackFailureOfSubject }>(SUBJECT))
    })

const error = (code: ShotstackErrorCode) => new ShotstackError({ code, params: { status: 400, detail: "Bad Request" } })

describe("shotstackFailureOf", () => {
    it.each([
        [ShotstackErrorCode.AuthFailed, "auth_refused", "not_sent"],
        [ShotstackErrorCode.NotFound, "not_found", "not_sent"],
        [ShotstackErrorCode.Rejected, "rejected", "not_sent"],
    ])("turns %s into a refusal %s proved %s, with Shotstack's words", (code, reason, proof) => {
        const thrown = shotstackFailureOf(error(code))

        // A refusal is a DomainError (`ProviderRegistryError`: reason = its code, provider and words in `params`), read through the
        // registry's own readers (one error base, DomainError only), not `reason` / `detail` members of the thrown object.
        expect(providerRefusalReason(thrown)).toBe(reason)
        expect(thrown).toMatchObject({ params: { provider: "shotstack", detail: "Bad Request" } })
        expect(providerRefusalDetail(thrown)).toBe("Bad Request")
        expect(proofOf(thrown)).toBe(proof)
    })

    it("rethrows a rate limit as it is, proved not_sent", () => {
        const cause = error(ShotstackErrorCode.RateLimited)

        expect(shotstackFailureOf(cause)).toBe(cause)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it.each([ShotstackErrorCode.Failed, ShotstackErrorCode.Unreachable, ShotstackErrorCode.Malformed])("proves %s unknown", (code) => {
        expect(proofOf(shotstackFailureOf(error(code)))).toBe("unknown")
    })

    it("passes a foreign failure through", () => {
        const cause = new Error("x")

        expect(shotstackFailureOf(cause)).toBe(cause)
    })
})
})

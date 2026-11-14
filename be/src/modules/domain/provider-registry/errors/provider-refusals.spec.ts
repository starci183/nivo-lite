import { isDomainError } from "@modules/platform/errors"
import { proofOf, withProof } from "../provider-call-failure"
import { PROVIDER_REGISTRY_MESSAGES } from "../messages/provider-registry.messages"
import {
    callProofOf,
    providerCallCause,
    providerCallFailure,
    providerRefusal,
    providerRefusalDetail,
    providerRefusalReason,
    registrarRefusal,
    registrarRefusalReason,
} from "./provider-refusals"
import { PROVIDER_REGISTRY_ERROR_KINDS, ProviderRegistryError, ProviderRegistryErrorCode } from "./provider-registry.error"

describe("provider-registry refusals: ProviderRegistryError codes and kinds", () => {
    it.each([
        ["rejected", ProviderRegistryErrorCode.RefusedRejected, "invalid"],
        ["not_found", ProviderRegistryErrorCode.RefusedNotFound, "not-found"],
        ["auth_refused", ProviderRegistryErrorCode.RefusedAuth, "forbidden"],
        ["no_credential", ProviderRegistryErrorCode.RefusedNoCredential, "conflict"],
        ["not_available", ProviderRegistryErrorCode.RefusedNotAvailable, "unavailable"],
    ] as const)("a provider refusal %s is %s (%s), carries the provider and its words, and reads back", (reason, code, kind) => {
        const cause = new Error("upstream")
        const refusal = providerRefusal("payos", reason, "the words", cause)

        expect(refusal).toBeInstanceOf(ProviderRegistryError)
        expect(isDomainError(refusal)).toBe(true)
        expect(refusal.code).toBe(code)
        expect(PROVIDER_REGISTRY_ERROR_KINDS[code]).toBe(kind)
        expect(refusal.params).toEqual({ provider: "payos", detail: "the words" })
        expect(refusal.cause).toBe(cause)
        expect(providerRefusalReason(refusal)).toBe(reason)
        expect(providerRefusalDetail(refusal)).toBe("the words")
        expect(registrarRefusalReason(refusal)).toBeNull()
        expect(callProofOf(refusal)).toBeNull()
    })

    it("a provider refusal without words carries no detail", () => {
        const refusal = providerRefusal("payos", "no_credential")

        expect(refusal.params).toEqual({ provider: "payos" })
        expect(refusal.cause).toBeUndefined()
        expect(providerRefusalDetail(refusal)).toBeNull()
    })

    it.each([
        ["not_available", ProviderRegistryErrorCode.DomainNotAvailable, "unavailable"],
        ["not_found", ProviderRegistryErrorCode.DomainNotFound, "not-found"],
        ["already_exists", ProviderRegistryErrorCode.DomainAlreadyExists, "conflict"],
        ["rejected", ProviderRegistryErrorCode.DomainRejected, "invalid"],
        ["contacts_required", ProviderRegistryErrorCode.DomainContactsRequired, "invalid"],
        ["contacts_unsupported", ProviderRegistryErrorCode.DomainContactsUnsupported, "invalid"],
        ["insufficient_balance", ProviderRegistryErrorCode.DomainInsufficientBalance, "conflict"],
        ["domain_locked", ProviderRegistryErrorCode.DomainLocked, "conflict"],
    ] as const)("a registrar refusal %s is %s (%s) and reads back as a registrar refusal only", (reason, code, kind) => {
        const refusal = registrarRefusal(reason, "route_code")

        expect(refusal.code).toBe(code)
        expect(PROVIDER_REGISTRY_ERROR_KINDS[code]).toBe(kind)
        expect(refusal.params).toEqual({ providerCode: "route_code" })
        expect(registrarRefusalReason(refusal)).toBe(reason)
        expect(providerRefusalReason(refusal)).toBeNull()
        expect(registrarRefusal(reason).params).toEqual({})
    })

    it("reads nothing from a failure that is no refusal", () => {
        for (const other of [new Error("x"), null, "text", new ProviderRegistryError({ code: ProviderRegistryErrorCode.LedgerConnectionRefused })]) {
            expect(providerRefusalReason(other)).toBeNull()
            expect(registrarRefusalReason(other)).toBeNull()
            expect(providerRefusalDetail(other)).toBeNull()
            expect(callProofOf(other)).toBeNull()
            expect(providerCallCause(other)).toBe(other)
        }
    })

    it.each([
        ["not_sent", ProviderRegistryErrorCode.CallNotSent],
        ["unknown", ProviderRegistryErrorCode.CallUnknown],
    ] as const)("a provider call failure %s keeps its proof and its cause", (proof, code) => {
        const cause = new Error("timeout")
        const failure = providerCallFailure(proof, cause)

        expect(failure.code).toBe(code)
        expect(PROVIDER_REGISTRY_ERROR_KINDS[code]).toBe("unavailable")
        expect(callProofOf(failure)).toBe(proof)
        expect(proofOf(failure)).toBe(proof)
        expect(providerCallCause(failure)).toBe(cause)
        expect(providerRefusalReason(failure)).toBeNull()
    })

    it("withProof wraps a failure that is no object and keeps an object failure as it is", () => {
        const wrapped = withProof("boom", "unknown")
        expect(wrapped).toMatchObject({ code: ProviderRegistryErrorCode.CallUnknown, cause: "boom" })

        const refusal = providerRefusal("x", "rejected")
        expect(withProof(refusal, "not_sent")).toBe(refusal)
        expect(proofOf(refusal)).toBe("not_sent")
        expect(proofOf(providerRefusal("x", "rejected"))).toBeNull()
    })

    it("every provider-registry code has a kind and a Vietnamese and English text", () => {
        for (const code of Object.values(ProviderRegistryErrorCode)) {
            expect(PROVIDER_REGISTRY_ERROR_KINDS[code]).toBeDefined()
            expect(PROVIDER_REGISTRY_MESSAGES.vi?.[`errors.${code}`]).toEqual(expect.any(String))
            expect(PROVIDER_REGISTRY_MESSAGES.en?.[`errors.${code}`]).toEqual(expect.any(String))
        }
    })
})

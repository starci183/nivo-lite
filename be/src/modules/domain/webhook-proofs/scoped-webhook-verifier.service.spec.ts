import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { HttpSecurityError, HttpSecurityErrorCode, WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import { ProviderSandboxError, ProviderSandboxErrorCode, type SandboxWebhookKeyService } from "@modules/domain/provider-sandbox"
import { ScopedWebhookVerifier } from "./scoped-webhook-verifier.service"
import type { WebhookProofRegistry } from "@modules/platform/http-security"

const BODY = Buffer.from(JSON.stringify({ eventId: "evt-1", status: "confirmed" }))

/** The registry answer when no proof is registered for the provider. */
const unknownProvider: WebhookProofRegistry["verify"] = (provider) =>
    Promise.reject(new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookProviderUnknown, params: { provider } }))

const build = async (prove: WebhookProofRegistry["verify"] = unknownProvider) => {
    const registry = mock<WebhookProofRegistry>({ verify: prove })
    const moduleRef = await Test.createTestingModule({
        providers: [ScopedWebhookVerifier, { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry }],
    }).compile()
    return moduleRef.get(ScopedWebhookVerifier)
}

describe("ScopedWebhookVerifier scoped proofs", () => {
    const scoped = {
        provider: "zalo",
        scope: "connection-1",
        rawBody: BODY,
        signature: "mac",
        timestamp: undefined,
    }

    it("accepts a delivery the registered proof accepts and hands the proof the scope and the exact bytes", async () => {
        const prove = jest.fn<Promise<void>, Parameters<WebhookProofRegistry["verify"]>>()
        prove.mockResolvedValue(undefined)
        const service = await build(prove)

        await expect(service.verify(scoped)).resolves.toBeUndefined()

        expect(prove).toHaveBeenCalledWith("zalo", {
            scope: "connection-1",
            rawBody: BODY,
            signature: "mac",
            timestamp: undefined,
        })
    })

    it("refuses a delivery the registered proof rejects", async () => {
        const service = await build(() =>
            Promise.reject(new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })),
        )

        await expect(service.verify(scoped)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookSignatureInvalid,
        })
    })

    it("refuses a provider with no registered proof", async () => {
        const service = await build()

        await expect(service.verify(scoped)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookProviderUnknown,
        })
    })
})

describe("ScopedWebhookVerifier and the one sandbox guard (rulings R58 + R60)", () => {
    const delivery = { provider: "zalo", scope: "11111111-1111-4111-8111-111111111111", rawBody: BODY, signature: undefined, timestamp: undefined }

    const withGuard = (verdict: SandboxWebhookKeyService["verdictOf"]) => {
        const registry = mock<WebhookProofRegistry>({ verify: jest.fn(unknownProvider) })
        const guard = mock<SandboxWebhookKeyService>({ verdictOf: jest.fn(verdict) })
        return { registry, guard, service: new ScopedWebhookVerifier(registry, guard) }
    }

    it("skips the provider proof for a sandbox account the guard proved by its sandbox key", async () => {
        const { service, registry, guard } = withGuard(() => Promise.resolve({ kind: "sandbox", workspaceId: "ws-1", provider: "zalo_oa" }))
        await expect(service.verify({ ...delivery, sandboxKey: "k" })).resolves.toBeUndefined()
        expect(guard.verdictOf).toHaveBeenCalledWith(delivery.scope, "k")
        expect(registry.verify).not.toHaveBeenCalled()
    })

    it("runs the provider proof unchanged for a live account, even when a sandbox key is presented", async () => {
        const { service, registry } = withGuard(() => Promise.resolve({ kind: "live" }))
        await expect(service.verify({ ...delivery, sandboxKey: "k" })).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookProviderUnknown })
        expect(registry.verify).toHaveBeenCalledTimes(1)
    })

    it("lets the guard's refusal through (a sandbox account without its key, or the sandbox off)", async () => {
        const refused = new ProviderSandboxError({ code: ProviderSandboxErrorCode.WebhookKeyRefused })
        const { service, registry } = withGuard(() => Promise.reject(refused))
        await expect(service.verify(delivery)).rejects.toBe(refused)
        expect(registry.verify).not.toHaveBeenCalled()
    })
})

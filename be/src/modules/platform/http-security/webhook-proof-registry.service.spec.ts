import { Test } from "@nestjs/testing"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { WebhookProofRegistryService } from "./webhook-proof-registry.service"
import type { WebhookProof } from "./webhook-proof.port"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async (): Promise<WebhookProofRegistryService> => {
    const moduleRef = await Test.createTestingModule({ providers: [WebhookProofRegistryService] }).compile()
    return moduleRef.get(WebhookProofRegistryService)
}

const proofOf = (provider: string): WebhookProof => ({ provider, prove: () => Promise.resolve(true) })

describe("WebhookProofRegistryService", () => {
    it("asks the proof registered for a provider with the request", async () => {
        const registry = await build()
        const prove = jest.fn().mockResolvedValue(true)
        registry.add({ provider: "zalo", prove })
        const request = { scope: "c1", rawBody: undefined, signature: "mac", timestamp: undefined }

        await expect(registry.verify("zalo", request)).resolves.toBeUndefined()

        expect(prove.mock.calls).toEqual([[request]])
    })

    it("refuses a delivery rejected by the registered proof with the existing error code", async () => {
        const registry = await build()
        registry.add({ provider: "zalo", prove: () => Promise.resolve(false) })
        await expect(
            registry.verify("zalo", { scope: "c1", rawBody: undefined, signature: "wrong", timestamp: undefined }),
        ).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookSignatureInvalid,
        })
    })

    it("refuses a provider with no proof registered", async () => {
        const registry = await build()

        await expect(
            registry.verify("telegram", {
                scope: "c1",
                rawBody: undefined,
                signature: undefined,
                timestamp: undefined,
            }),
        ).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookProviderUnknown })
    })

    it("refuses a second proof for the same provider", async () => {
        const registry = await build()
        registry.add(proofOf("zalo"))

        expect(() => registry.add(proofOf("zalo"))).toThrow(HttpSecurityError)
        expect(thrownBy(() => registry.add(proofOf("zalo")))).toEqual(
            objectLike({ code: HttpSecurityErrorCode.WebhookProviderUnknown }),
        )
    })
})

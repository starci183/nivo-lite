import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { GenericWebhookProofService, signBody } from "./generic-webhook-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const SECRET = "endpoint-secret"
const BODY = Buffer.from('{"type":"invoice.paid"}')

const build = async (secret: unknown = { kind: "ok", value: { webhookSecret: SECRET, workspaceId: "ws-1" } }) => {
    const registry = mock<WebhookProofRegistry>()
    const secrets = mock<ConnectionSecretReadsService>({ secretOf: jest.fn().mockResolvedValue(secret) })
    const container = await Test.createTestingModule({
        providers: [
            GenericWebhookProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: ConnectionSecretReadsService, useValue: secrets },
        ],
    }).compile()
    return { proof: container.get(GenericWebhookProofService), registry, secrets }
}

const request = (over: Record<string, unknown> = {}) => ({
    scope: CONNECTION,
    rawBody: BODY,
    signature: signBody(SECRET, BODY),
    timestamp: undefined,
    ...over,
})

describe("GenericWebhookProofService", () => {
    it("registers itself as the proof of the generic webhook once the app has started", async () => {
        const { proof, registry } = await build()

        proof.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(proof)
        expect(proof.provider).toBe("generic_webhook")
    })

    it("proves a body signed with the secret of the endpoint the route names, with or without the sha256 prefix", async () => {
        const { proof, secrets } = await build()

        await expect(proof.prove(request())).resolves.toBe(true)
        await expect(proof.prove(request({ signature: "sha256=" + signBody(SECRET, BODY) }))).resolves.toBe(true)
        expect(secrets.secretOf).toHaveBeenCalledWith(CONNECTION, "webhook")
    })

    it("refuses a body that was changed, a signature under another secret, and a signature of the wrong length", async () => {
        const { proof } = await build()

        await expect(proof.prove(request({ rawBody: Buffer.from('{"type":"other"}') }))).resolves.toBe(false)
        await expect(proof.prove(request({ signature: signBody("other-secret", BODY) }))).resolves.toBe(false)
        await expect(proof.prove(request({ signature: "abc" }))).resolves.toBe(false)
    })

    it.each([
        ["no signature", { signature: undefined }],
        ["no body", { rawBody: undefined }],
        ["a scope that is not an id", { scope: "not-a-uuid" }],
    ])("refuses %s without asking for any secret", async (_name, over) => {
        const { proof, secrets } = await build()

        await expect(proof.prove(request(over))).resolves.toBe(false)
        expect(secrets.secretOf).not.toHaveBeenCalled()
    })

    it("refuses when the connection cannot be used", async () => {
        const { proof } = await build({ kind: "refused", code: "NOT_FOUND" })

        await expect(proof.prove(request())).resolves.toBe(false)
    })
})

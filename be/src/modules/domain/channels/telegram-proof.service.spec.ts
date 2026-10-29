import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { TelegramProofService } from "./telegram-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"

const build = async (secret: string | null) => {
    const secrets = mock<ConnectionSecretReadsService>()
    secrets.secretOf.mockResolvedValue(
        secret === null
            ? { kind: "refused", code: ConnectionSecretsErrorCode.NotFound }
            : {
                  kind: "ok",
                  value: { workspaceId: "ws-1", credential: "123:token", webhookSecret: secret, tokenExpiresAt: null },
              },
    )
    const registry = mock<WebhookProofRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: ConnectionSecretReadsService, useValue: secrets },
        ],
    }).compile()
    return { proof: moduleRef.get(TelegramProofService), registry, secrets }
}

const request = (scope: string, signature?: string) => ({ scope, rawBody: undefined, signature, timestamp: undefined })

describe("TelegramProofService", () => {
    it("registers itself for the telegram door when the module starts", async () => {
        const { proof, registry } = await build("s")

        proof.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    describe("prove", () => {
        it("accepts the secret of the connection the route names", async () => {
            const { proof, secrets } = await build("hook-secret")

            await expect(proof.prove(request(CONNECTION, "hook-secret"))).resolves.toBe(true)
            expect(secrets.secretOf).toHaveBeenCalledWith(CONNECTION, "telegram")
        })

        it("refuses another secret, a missing header, a route that is not a connection id and a connection that is gone", async () => {
            const wrong = await build("hook-secret")
            const gone = await build(null)

            await expect(wrong.proof.prove(request(CONNECTION, "other"))).resolves.toBe(false)
            await expect(wrong.proof.prove(request(CONNECTION))).resolves.toBe(false)
            await expect(wrong.proof.prove(request("not-a-uuid", "hook-secret"))).resolves.toBe(false)
            await expect(gone.proof.prove(request(CONNECTION, "hook-secret"))).resolves.toBe(false)
            expect(wrong.secrets.secretOf).toHaveBeenCalledTimes(1)
        })
    })
})

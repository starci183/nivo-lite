import { mock } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { TelegramProofService } from "./telegram-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"

const build = (secret: string | null) => {
    const secrets = mock<ConnectionSecretsService>()
    secrets.secretOf.mockResolvedValue(
        secret === null
            ? { kind: "refused", code: ConnectionSecretsErrorCode.NotFound }
            : { kind: "ok", value: { workspaceId: "ws-1", credential: "123:token", webhookSecret: secret, tokenExpiresAt: null } },
    )
    const registry = mock<WebhookProofRegistry>()
    return { proof: new TelegramProofService(registry, secrets), registry, secrets }
}

const request = (scope: string, signature?: string) => ({ scope, rawBody: undefined, signature, timestamp: undefined })

describe("TelegramProofService", () => {
    it("registers itself for the telegram door when the module starts", () => {
        const { proof, registry } = build("s")

        proof.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    describe("prove", () => {
        it("accepts the secret of the connection the route names", async () => {
            const { proof, secrets } = build("hook-secret")

            await expect(proof.prove(request(CONNECTION, "hook-secret"))).resolves.toBe(true)
            expect(secrets.secretOf).toHaveBeenCalledWith(CONNECTION, "telegram")
        })

        it("refuses another secret, a missing header, a route that is not a connection id and a connection that is gone", async () => {
            const wrong = build("hook-secret")
            const gone = build(null)

            await expect(wrong.proof.prove(request(CONNECTION, "other"))).resolves.toBe(false)
            await expect(wrong.proof.prove(request(CONNECTION))).resolves.toBe(false)
            await expect(wrong.proof.prove(request("not-a-uuid", "hook-secret"))).resolves.toBe(false)
            await expect(gone.proof.prove(request(CONNECTION, "hook-secret"))).resolves.toBe(false)
            expect(wrong.secrets.secretOf).toHaveBeenCalledTimes(1)
        })
    })
})

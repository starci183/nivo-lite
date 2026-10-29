import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { PaymentSecretsService } from "./payment-secrets.service"

const CONNECTION_ID = "0b5d3f4e-1c2a-4b6d-8e7f-9a0b1c2d3e4f"

const SECRET = {
    workspaceId: "ws-1",
    credential: JSON.stringify({ secureKey: "k" }),
    webhookSecret: "hook",
    tokenExpiresAt: null,
}

const build = async () => {
    const reads = mock<ConnectionSecretReadsService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentSecretsService,
            { provide: ConnectionSecretReadsService, useValue: reads },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { secrets: moduleRef.get(PaymentSecretsService), reads, logger }
}

describe("PaymentSecretsService", () => {
    it("answers the workspace, the decrypted credential and the webhook secret of a connection of the provider", async () => {
        const { secrets, reads } = await build()
        reads.secretOf.mockResolvedValue(ok(SECRET))

        await expect(secrets.load(CONNECTION_ID, "casso")).resolves.toEqual({
            workspaceId: "ws-1",
            credential: JSON.stringify({ secureKey: "k" }),
            webhookSecret: "hook",
        })
        expect(reads.secretOf).toHaveBeenCalledWith(CONNECTION_ID, "casso")
    })

    it("answers null for an id that is not a connection id without asking the owner", async () => {
        const { secrets, reads } = await build()

        await expect(secrets.load("not-a-uuid", "casso")).resolves.toBeNull()
        expect(reads.secretOf).not.toHaveBeenCalled()
    })

    it("answers null, quietly, for a missing, foreign or disconnected connection", async () => {
        const { secrets, reads, logger } = await build()
        reads.secretOf.mockResolvedValue(refused(ConnectionSecretsErrorCode.NotFound))

        await expect(secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("answers null and logs when the credential cannot be decrypted", async () => {
        const { secrets, reads, logger } = await build()
        reads.secretOf.mockResolvedValue(refused(ConnectionSecretsErrorCode.Unreadable))

        await expect(secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        expect(logger.error).toHaveBeenCalledWith("billing.credential.unreadable", expect.anything(), {
            connectionId: CONNECTION_ID,
        })
    })
})

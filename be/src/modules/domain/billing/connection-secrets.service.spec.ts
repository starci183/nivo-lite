import { createCipheriv, randomBytes } from "node:crypto"
import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import { ConnectionSecretsService } from "./connection-secrets.service"
import { SELECT_CONNECTION_SECRET } from "./persistence/bank-feed.sql"

const KEY = randomBytes(32).toString("base64")
const CONNECTION_ID = "0b5d3f4e-1c2a-4b6d-8e7f-9a0b1c2d3e4f"

const encrypt = (plain: string): string => {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(KEY, "base64"), iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

const optionsWith = (channelTokenKey: Secret | undefined): BillingOptions => ({
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: undefined, workspaceId: undefined },
    channelTokenKey,
})

const build = async (rows: Array<object>, options: BillingOptions = optionsWith(new Secret(KEY))) => {
    const em = mockEntityManager({ query: [SELECT_CONNECTION_SECRET, rows] })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionSecretsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: BILLING_OPTIONS, useValue: builder<BillingOptions>(optionsWith(undefined))(options) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { secrets: moduleRef.get(ConnectionSecretsService), em, logger }
}

const row = (over: Record<string, unknown> = {}) => ({
    workspace_id: "ws-1",
    status: "connected",
    provider: "casso",
    ciphertext: encrypt(JSON.stringify({ secureKey: "k" })),
    webhook_secret: "hook",
    ...over,
})

describe("ConnectionSecretsService", () => {
    it("answers the workspace, the decrypted credential and the webhook secret of a connection of the provider", async () => {
        const { secrets, em } = await build([row()])

        await expect(secrets.load(CONNECTION_ID, "casso")).resolves.toEqual({
            workspaceId: "ws-1",
            credential: JSON.stringify({ secureKey: "k" }),
            webhookSecret: "hook",
        })
        expect(em.query).toHaveBeenCalledWith(SELECT_CONNECTION_SECRET, [CONNECTION_ID])
    })

    it("answers null for an id that is not a connection id without asking the database", async () => {
        const { secrets, em } = await build([row()])

        await expect(secrets.load("not-a-uuid", "casso")).resolves.toBeNull()
        expect(em.query).not.toHaveBeenCalled()
    })

    it("answers null for a missing connection, another provider and a disconnected connection", async () => {
        const missing = await build([])
        const other = await build([row({ provider: "payos" })])
        const off = await build([row({ status: "disconnected" })])

        await expect(missing.secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        await expect(other.secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        await expect(off.secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
    })

    it("answers null and logs when the credential cannot be decrypted", async () => {
        const wrongKey = await build([row()], optionsWith(new Secret(randomBytes(32).toString("base64"))))
        const noKey = await build([row()], optionsWith(undefined))

        await expect(wrongKey.secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        await expect(noKey.secrets.load(CONNECTION_ID, "casso")).resolves.toBeNull()
        expect(wrongKey.logger.error).toHaveBeenCalledWith("billing.credential.unreadable", expect.anything(), {
            connectionId: CONNECTION_ID,
        })
    })
})

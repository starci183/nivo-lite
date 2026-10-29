import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import type { ConnectionSecret } from "@modules/domain/connection-secrets"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { ConnectionSecretReadsService } from "./connection-secret-reads.service"
import { ConnectionEntity } from "./persistence/entities"

const connectionOf = entityRowBuilder<ConnectionEntity>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "telegram",
    status: "connected",
})

const secretOf = builder<ConnectionSecret>({
    workspaceId: "ws-1",
    credential: "123:token",
    webhookSecret: "hook",
    tokenExpiresAt: null,
})

const NOT_FOUND = { kind: "refused", code: ConnectionSecretsErrorCode.NotFound }

const build = async (em: MockEntityManager) => {
    const secrets = mock<ConnectionSecretsService>()
    secrets.openFor.mockResolvedValue({ kind: "ok", value: secretOf() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionSecretReadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: ConnectionSecretsService, useValue: secrets },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionSecretReadsService), secrets }
}

describe("ConnectionSecretReadsService", () => {
    describe("secretOf", () => {
        it("hands the facts of the connection to the secrets capability", async () => {
            const em = mockEntityManager({ findOne: [ConnectionEntity, connectionOf()] })
            const { service, secrets } = await build(em)

            await expect(service.secretOf("c-1", "telegram")).resolves.toEqual({ kind: "ok", value: secretOf() })
            expect(secrets.openFor).toHaveBeenCalledWith(
                { id: "c-1", workspaceId: "ws-1", provider: "telegram", status: "connected" },
                "telegram",
                em,
            )
        })

        it("reads through the transaction manager it is given", async () => {
            const em = mockEntityManager()
            const inside = mockEntityManager({ findOne: [ConnectionEntity, connectionOf()] })
            const { service, secrets } = await build(em)

            await service.secretOf("c-1", "telegram", inside)

            expect(em.findOne).not.toHaveBeenCalled()
            expect(secrets.openFor).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }), "telegram", inside)
        })

        it("refuses a connection that is gone", async () => {
            const { service, secrets } = await build(mockEntityManager({ findOne: [ConnectionEntity, null] }))

            await expect(service.secretOf("c-1", "telegram")).resolves.toMatchObject(NOT_FOUND)
            expect(secrets.openFor).not.toHaveBeenCalled()
        })
    })

    describe("botToken", () => {
        it("answers the token only to the workspace that owns the connection", async () => {
            const { service } = await build(mockEntityManager({ findOne: [ConnectionEntity, connectionOf()] }))

            await expect(service.botToken("ws-1", "c-1")).resolves.toEqual({ kind: "ok", value: "123:token" })
            await expect(service.botToken("ws-2", "c-1")).resolves.toMatchObject(NOT_FOUND)
        })

        it("passes the refusal of a connection that is gone", async () => {
            const { service } = await build(mockEntityManager({ findOne: [ConnectionEntity, null] }))

            await expect(service.botToken("ws-1", "c-1")).resolves.toMatchObject(NOT_FOUND)
        })
    })

    describe("dueZalo", () => {
        const horizon = new Date("2026-10-12T17:00:00.000Z")

        it("keeps the expiring ids that are live Zalo connections, soonest first", async () => {
            const em = mockEntityManager({ find: [ConnectionEntity, [connectionOf({ id: "c-2" })]] })
            const { service, secrets } = await build(em)
            secrets.expiringBefore.mockResolvedValue(["c-1", "c-2"])

            await expect(service.dueZalo(horizon)).resolves.toEqual(["c-2"])
            expect(secrets.expiringBefore).toHaveBeenCalledWith(horizon, 500)
        })

        it("reads no connections when no token is expiring", async () => {
            const em = mockEntityManager()
            const { service, secrets } = await build(em)
            secrets.expiringBefore.mockResolvedValue([])

            await expect(service.dueZalo(horizon)).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })
    })
})

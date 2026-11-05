import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ConnectionApiTokenService } from "./connection-api-token.service"
import { ConnectionSecretsService } from "./connection-secrets.service"
import { ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import { ConnectionSecretEntity } from "./persistence/entities"

/** The sealed form the secrets double writes for a plain token. */
const sealedOf = (plain: string): string => `sealed(${plain})`

/** One stored secret row; the credential and the token are sealed. */
const storedOf = entityRowBuilder<ConnectionSecretEntity>({
    connectionId: "c-1",
    ciphertext: sealedOf("stored-key"),
    apiTokenCiphertext: null,
    webhookSecret: "hook",
    tokenExpiresAt: null,
    refreshLockUntil: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

const build = async (em: MockEntityManager) => {
    const secrets = mock<ConnectionSecretsService>({
        seal: jest.fn((plain: string) => sealedOf(plain)),
        open: jest.fn((sealed: string) =>
            sealed === sealedOf("tok-1") ? ok("tok-1") : refused(ConnectionSecretsErrorCode.Unreadable),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionApiTokenService,
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return moduleRef.get(ConnectionApiTokenService)
}

describe("ConnectionApiTokenService", () => {
    it("seals the token into the row of the connection and says whether the row existed", async () => {
        const stored = mockEntityManager({ update: [ConnectionSecretEntity, { affected: 1 }] })
        const missing = mockEntityManager({ update: [ConnectionSecretEntity, {}] })

        await expect((await build(stored)).write("c-1", "tok-1")).resolves.toBe(true)
        await expect((await build(missing)).write("c-2", "tok-2")).resolves.toBe(false)

        const calls = evaluatedCalls(stored.update.mock.calls)
        expect(calls).toEqual([
            ["ConnectionSecretEntity", { connectionId: "c-1" }, { apiTokenCiphertext: "sealed(tok-1)" }],
        ])
    })

    it("opens a stored token again", async () => {
        const em = mockEntityManager({
            findOne: [ConnectionSecretEntity, storedOf({ apiTokenCiphertext: sealedOf("tok-1") })],
        })

        await expect((await build(em)).read("c-1")).resolves.toBe("tok-1")
    })

    it.each([
        ["no row", null],
        ["no token", storedOf()],
        ["a token that cannot be opened", storedOf({ apiTokenCiphertext: sealedOf("other") })],
    ])("reads null for %s", async (_name, row) => {
        const em = mockEntityManager({ findOne: [ConnectionSecretEntity, row] })

        await expect((await build(em)).read("c-1")).resolves.toBeNull()
    })

    it.each([
        ["a token", storedOf({ apiTokenCiphertext: sealedOf("tok-1") }), true],
        ["no token", storedOf(), false],
        ["no row", null, false],
    ])("tells whether the connection holds a token: %s", async (_name, row, expected) => {
        const em = mockEntityManager({ findOne: [ConnectionSecretEntity, row] })

        await expect((await build(em)).has("c-1")).resolves.toBe(expected)
    })
})

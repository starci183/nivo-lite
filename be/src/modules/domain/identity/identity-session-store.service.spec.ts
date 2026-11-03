import { Test } from "@nestjs/testing"
import { LessThan, Not } from "typeorm"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IdentityRefreshTokenEntity, IdentitySessionEntity } from "./persistence/entities"
import { IdentitySessionStoreService } from "./identity-session-store.service"

const NOW = new Date("2026-11-09T10:00:00.000Z")
const LATER = new Date("2026-11-09T11:00:00.000Z")

const tokenRow = builder<IdentityRefreshTokenEntity>({
    id: "t1",
    sessionId: "s1",
    userId: "u1",
    tokenHash: "hash-1",
    expiresAt: LATER,
    usedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const transaction = fakeTransaction(em)
    const moduleRef = await Test.createTestingModule({
        providers: [IdentitySessionStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(IdentitySessionStoreService), em, transaction }
}

describe("IdentitySessionStoreService / reads and session writes", () => {
    it("finds a token by its digest as the record the package reads, and answers null for an unknown one", async () => {
        const known = await build(
            mockEntityManager({ findOne: [IdentityRefreshTokenEntity, tokenRow({ usedAt: NOW })] }),
        )
        await expect(known.store.findToken("hash-1")).resolves.toEqual({
            id: "t1",
            sessionId: "s1",
            userId: "u1",
            tokenHash: "hash-1",
            expiresAt: LATER,
            usedAt: NOW,
        })
        expect(known.em.findOne).toHaveBeenCalledWith(IdentityRefreshTokenEntity, { where: { tokenHash: "hash-1" } })

        const unknown = await build(mockEntityManager({ findOne: [IdentityRefreshTokenEntity, null] }))
        await expect(unknown.store.findToken("nope")).resolves.toBeNull()
    })

    it("marks a session refreshed", async () => {
        const { store, em } = await build(mockEntityManager({ update: [IdentitySessionEntity, { affected: 1 }] }))

        await store.touchSession("s1", NOW)

        expect(em.update).toHaveBeenCalledWith(IdentitySessionEntity, { id: "s1" }, { refreshedAt: NOW })
    })

    it("ends one session, and every session of an account but one", async () => {
        const { store, em } = await build(mockEntityManager({ delete: [IdentitySessionEntity, { affected: 1 }] }))

        await store.closeSession("s1")
        await store.closeOtherSessions("u1", "s2")

        expect(em.delete).toHaveBeenNthCalledWith(1, IdentitySessionEntity, { id: "s1" })
        expect(em.delete).toHaveBeenNthCalledWith(2, IdentitySessionEntity, { userId: "u1", id: Not("s2") })
    })
})

describe("IdentitySessionStoreService / transaction", () => {
    it("opens a session and stores its first live token in one transaction", async () => {
        const { store, em, transaction } = await build(
            mockEntityManager({
                insert: [
                    [IdentitySessionEntity, {}],
                    [IdentityRefreshTokenEntity, {}],
                ],
            }),
        )

        await store.transaction(async (tx) => {
            await tx.openSession({ id: "s1", userId: "u1", now: NOW, userAgent: "Mozilla", ip: "203.0.113.9" })
            await tx.insertToken({ id: "t1", sessionId: "s1", userId: "u1", tokenHash: "hash-1", expiresAt: LATER })
        })

        expect(em.insert).toHaveBeenNthCalledWith(1, IdentitySessionEntity, {
            id: "s1",
            userId: "u1",
            createdAt: NOW,
            refreshedAt: NOW,
            userAgent: "Mozilla",
            ip: "203.0.113.9",
        })
        expect(em.insert).toHaveBeenNthCalledWith(2, IdentityRefreshTokenEntity, {
            id: "t1",
            sessionId: "s1",
            userId: "u1",
            tokenHash: "hash-1",
            expiresAt: LATER,
            usedAt: null,
        })
        expect(transaction.commits).toBe(1)
    })

    it("locks the token row it rotates, spends it and sweeps the expired tokens of the account", async () => {
        const { store, em } = await build(
            mockEntityManager({
                findOne: [IdentityRefreshTokenEntity, tokenRow()],
                update: [IdentityRefreshTokenEntity, { affected: 1 }],
                delete: [IdentityRefreshTokenEntity, { affected: 3 }],
            }),
        )

        const row = await store.transaction(async (tx) => {
            const found = await tx.findTokenForUpdate("hash-1")
            await tx.markTokenUsed("t1", NOW)
            await tx.deleteExpiredTokens("u1", NOW)
            return found
        })

        expect(row).toMatchObject({ id: "t1", tokenHash: "hash-1", usedAt: null })
        expect(em.findOne).toHaveBeenCalledWith(IdentityRefreshTokenEntity, {
            where: { tokenHash: "hash-1" },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.update).toHaveBeenCalledWith(IdentityRefreshTokenEntity, { id: "t1" }, { usedAt: NOW })
        expect(em.delete).toHaveBeenCalledWith(IdentityRefreshTokenEntity, { userId: "u1", expiresAt: LessThan(NOW) })
    })

    it("answers null for a token the transaction does not find", async () => {
        const { store } = await build(mockEntityManager({ findOne: [IdentityRefreshTokenEntity, null] }))

        await expect(store.transaction((tx) => tx.findTokenForUpdate("nope"))).resolves.toBeNull()
    })
})

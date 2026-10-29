import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MessageCursorsService } from "./message-cursors.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MessageCursorsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(MessageCursorsService)
}

/** A manager whose one query builder answers these raw rows. */
const answering = (rows: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder({ getRawMany: rows })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("MessageCursorsService > newestAuthored", () => {
    it("answers the newest message of the account", async () => {
        const { em, fake } = answering([{ id: "m1", createdAt: "2026-10-25T01:00:00+00:00" }])

        await expect((await build(em)).newestAuthored("ws", "u1", "sales")).resolves.toEqual({
            id: "m1",
            createdAt: "2026-10-25T01:00:00+00:00",
        })
        expect(fake.callsOf("limit")).toEqual([[1]])
        expect(fake.callsOf("orderBy")).toEqual([["m.created_at", "DESC"]])
    })

    it("answers null before any message and for rows it cannot read", async () => {
        const none = answering([])
        const broken = answering(["broken"])
        const partial = answering([{ id: 7, createdAt: "x" }])

        await expect((await build(none.em)).newestAuthored("ws", "u1", "sales")).resolves.toBeNull()
        await expect((await build(broken.em)).newestAuthored("ws", "u1", "sales")).resolves.toBeNull()
        await expect((await build(partial.em)).newestAuthored("ws", "u1", "sales")).resolves.toBeNull()
    })

    it("reads through the manager it is handed", async () => {
        const own = mockEntityManager()
        const { em: handed } = answering([])

        await (await build(own)).newestAuthored("ws", "u1", "sales", handed)

        expect(own.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("MessageCursorsService > createdAtOf", () => {
    it("answers the creation instant of the message", async () => {
        const { em } = answering([{ createdAt: "2026-10-25T01:00:00+00:00" }])

        await expect((await build(em)).createdAtOf("ws", "sales", "m1")).resolves.toBe("2026-10-25T01:00:00+00:00")
    })

    it("answers null when no readable instant comes back", async () => {
        const none = answering([])
        const broken = answering(["broken", { createdAt: 7 }])

        await expect((await build(none.em)).createdAtOf("ws", "sales", "m1")).resolves.toBeNull()
        await expect((await build(broken.em)).createdAtOf("ws", "sales", "m1")).resolves.toBeNull()
    })

    it("reads through the manager it is handed", async () => {
        const own = mockEntityManager()
        const { em: handed } = answering([])

        await (await build(own)).createdAtOf("ws", "sales", "m1", handed)

        expect(own.createQueryBuilder).not.toHaveBeenCalled()
    })
})

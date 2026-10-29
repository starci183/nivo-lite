import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MetaThreadsService } from "./meta-threads.service"
import { MetaThreadEntity } from "./persistence/entities"

const serviceOf = async (primary: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MetaThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
    }).compile()
    return moduleRef.get(MetaThreadsService)
}

const touchingManager = () => {
    const fake = fakeQueryBuilder({ execute: {} })
    const manager = mockEntityManager()
    manager.createQueryBuilder.mockReturnValue(fake.builder)
    return { fake, manager }
}

describe("MetaThreadsService", () => {
    it("touches the window of the person in the given transaction", async () => {
        const primary = mockEntityManager()
        const { fake, manager } = touchingManager()
        const thread = { connectionId: "c-1", platform: "facebook", userId: "p-1", at: "2026-10-13T00:00:00.000Z" }

        await expect((await serviceOf(primary)).touch(thread, manager)).resolves.toBeUndefined()

        expect(fake.callsOf("insert")).toEqual([[]])
        expect(fake.callsOf("values")).toEqual([
            [
                {
                    connectionId: "c-1",
                    platform: "facebook",
                    userId: "p-1",
                    lastUserAt: new Date("2026-10-13T00:00:00.000Z"),
                },
            ],
        ])
        expect(fake.callsOf("orUpdate")).toEqual([
            [
                ["last_user_at"],
                ["connection_id", "platform", "user_id"],
                { overwriteCondition: { where: "meta_threads.last_user_at < EXCLUDED.last_user_at" } },
            ],
        ])
        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("touches the window through the primary manager when no transaction is given", async () => {
        const { fake, manager: primary } = touchingManager()

        await expect(
            (await serviceOf(primary)).touch({
                connectionId: "c-2",
                platform: "instagram",
                userId: "p-2",
                at: "2026-10-13T01:00:00.000Z",
            }),
        ).resolves.toBeUndefined()

        expect(fake.callsOf("values")[0]?.[0]).toMatchObject({
            connectionId: "c-2",
            platform: "instagram",
            userId: "p-2",
        })
    })

    it("returns no last message when the person has never written", async () => {
        const primary = mockEntityManager({ findOne: [MetaThreadEntity, null] })

        await expect(
            (await serviceOf(primary)).lastUserAt({ connectionId: "c-1", platform: "facebook", userId: "p-1" }),
        ).resolves.toBeNull()

        expect(primary.findOne).toHaveBeenCalledWith(MetaThreadEntity, {
            select: { lastUserAt: true },
            where: { connectionId: "c-1", platform: "facebook", userId: "p-1" },
        })
    })

    it.each([
        { timestamp: new Date("2026-10-13T00:00:00.000Z"), milliseconds: 1791849600000 },
        { timestamp: "2026-10-13T00:00:01.250Z", milliseconds: 1791849601250 },
    ])("returns the epoch milliseconds of $timestamp", async ({ timestamp, milliseconds }) => {
        const thread = Object.assign(new MetaThreadEntity(), { lastUserAt: timestamp })
        const primary = mockEntityManager({ findOne: [MetaThreadEntity, thread] })

        await expect(
            (await serviceOf(primary)).lastUserAt({ connectionId: "c-2", platform: "instagram", userId: "p-2" }),
        ).resolves.toBe(milliseconds)
    })
})

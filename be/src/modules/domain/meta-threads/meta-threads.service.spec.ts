import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MetaThreadsService } from "./meta-threads.service"
import { FIND_META_THREAD, TOUCH_META_THREAD } from "./persistence/meta-threads.sql"

describe("MetaThreadsService", () => {
    it("touches the window of the person in the given transaction", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager({ query: [TOUCH_META_THREAD, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [MetaThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()
        const thread = { connectionId: "c-1", platform: "facebook", userId: "p-1", at: "2026-10-13T00:00:00.000Z" }

        await expect(moduleRef.get(MetaThreadsService).touch(thread, tx)).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(TOUCH_META_THREAD, ["c-1", "facebook", "p-1", "2026-10-13T00:00:00.000Z"])
        expect(primary.query).not.toHaveBeenCalled()
    })

    it("touches the window through the primary manager when no transaction is given", async () => {
        const primary = mockEntityManager({ query: [TOUCH_META_THREAD, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [MetaThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()

        await expect(
            moduleRef.get(MetaThreadsService).touch({
                connectionId: "c-2",
                platform: "instagram",
                userId: "p-2",
                at: "2026-10-13T01:00:00.000Z",
            }),
        ).resolves.toBeUndefined()

        expect(primary.query).toHaveBeenCalledWith(TOUCH_META_THREAD, [
            "c-2",
            "instagram",
            "p-2",
            "2026-10-13T01:00:00.000Z",
        ])
    })

    it("returns no last message when the person has never written", async () => {
        const primary = mockEntityManager({ query: [FIND_META_THREAD, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [MetaThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()

        await expect(
            moduleRef.get(MetaThreadsService).lastUserAt({ connectionId: "c-1", platform: "facebook", userId: "p-1" }),
        ).resolves.toBeNull()

        expect(primary.query).toHaveBeenCalledWith(FIND_META_THREAD, ["c-1", "facebook", "p-1"])
    })

    it.each([
        { timestamp: new Date("2026-10-13T00:00:00.000Z"), milliseconds: 1791849600000 },
        { timestamp: "2026-10-13T00:00:01.250Z", milliseconds: 1791849601250 },
    ])("returns the epoch milliseconds of $timestamp", async ({ timestamp, milliseconds }) => {
        const primary = mockEntityManager({ query: [FIND_META_THREAD, [{ last_user_at: timestamp }]] })
        const moduleRef = await Test.createTestingModule({
            providers: [MetaThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()

        await expect(
            moduleRef.get(MetaThreadsService).lastUserAt({ connectionId: "c-2", platform: "instagram", userId: "p-2" }),
        ).resolves.toBe(milliseconds)

        expect(primary.query).toHaveBeenCalledWith(FIND_META_THREAD, ["c-2", "instagram", "p-2"])
    })
})

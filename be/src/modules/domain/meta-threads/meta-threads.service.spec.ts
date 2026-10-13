import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MetaThreadsService } from "./meta-threads.service"
import { TOUCH_META_THREAD } from "./persistence/meta-threads.sql"

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
})

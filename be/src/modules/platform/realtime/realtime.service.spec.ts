import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PUBLISH_PRIVATE_BROADCAST } from "./persistence/realtime.sql"
import { RealtimeService } from "./realtime.service"

describe("RealtimeService", () => {
    it("serializes an authored payload and publishes only through the private backend function", async () => {
        const manager = mockEntityManager({ query: [[PUBLISH_PRIVATE_BROADCAST, []]] })
        const container = await Test.createTestingModule({
            providers: [RealtimeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
        }).compile()

        await expect(
            container.get(RealtimeService).publishPrivate({
                topic: "chat-typing:workspace:room:office",
                event: "typing",
                payload: { id: "member", typing: true },
            }),
        ).resolves.toBeUndefined()
        expect(manager.query).toHaveBeenCalledWith(PUBLISH_PRIVATE_BROADCAST, [
            "chat-typing:workspace:room:office",
            "typing",
            '{"id":"member","typing":true}',
        ])
    })
})

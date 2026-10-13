import { mockEntityManager } from "@starci/jest-preset"
import { InboundEventsService } from "./inbound-events.service"
import { INSERT_UNROUTED_EVENT } from "./persistence/inbound-events.sql"

describe("InboundEventsService", () => {
    it("keeps an unrouted message in the inbox under a dedupe key made of its channel and event id", async () => {
        const manager = mockEntityManager({ query: [INSERT_UNROUTED_EVENT, []] })

        await new InboundEventsService().keepUnrouted(
            { workspaceId: "ws-1", channel: "telegram", sender: "Minh", body: "Hello", eventId: "tg:c-1:555:9" },
            manager,
        )

        expect(manager.query).toHaveBeenCalledWith(INSERT_UNROUTED_EVENT, [
            "ws-1",
            "telegram",
            "Minh",
            "Hello",
            "tg:c-1:555:9",
            "telegram:message:tg:c-1:555:9",
        ])
    })
})

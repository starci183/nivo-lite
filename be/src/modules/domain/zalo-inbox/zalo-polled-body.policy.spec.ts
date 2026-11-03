import { zaloDeliveryIdOf } from "./zalo-delivery-id.policy"
import { polledRawBody } from "./zalo-polled-body.policy"

describe("polledRawBody", () => {
    it("builds the body the webhook posts for a customer text, which gets the webhook delivery id", () => {
        const body = polledRawBody({ messageId: "m-1", userId: "user-1", text: "Alo", sentAt: 1_762_192_200_000 })

        expect(JSON.parse(body.toString("utf8"))).toEqual({
            event_name: "user_send_text",
            timestamp: "1762192200000",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: "Alo" },
        })
        expect(zaloDeliveryIdOf("c-1", body)).toBe("c-1:m-1")
    })
})

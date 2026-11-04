import { Test } from "@nestjs/testing"
import { parseJsonText } from "@modules/platform/primitives"
import { zaloDeliveryIdOf } from "./zalo-delivery-id.policy"
import { polledRawBody } from "./zalo-polled-body.policy"

const SUBJECT = Symbol("zalo-polled-body.policy")

const buildSubject = async (): Promise<typeof polledRawBody> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: polledRawBody }],
    }).compile()
    return moduleRef.get<typeof polledRawBody>(SUBJECT)
}

describe("polledRawBody", () => {
    it("builds the body the webhook posts for a customer text, which gets the webhook delivery id", async () => {
        const build = await buildSubject()

        const body = build({ messageId: "m-1", userId: "user-1", text: "Alo", sentAt: 1_762_192_200_000 })

        expect(parseJsonText(body.toString("utf8"))).toEqual({
            ok: true,
            value: {
                event_name: "user_send_text",
                timestamp: "1762192200000",
                sender: { id: "user-1" },
                message: { msg_id: "m-1", text: "Alo" },
            },
        })
        expect(zaloDeliveryIdOf("c-1", body)).toBe("c-1:m-1")
    })
})

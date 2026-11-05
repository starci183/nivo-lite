import { zaloInboxEntities } from "@modules/domain/zalo-inbox"
import { entityOf } from "./entity.builder"

const ZaloInboxEntity: (typeof zaloInboxEntities)[0] = zaloInboxEntities[0]
type ZaloInboxEntity = InstanceType<typeof ZaloInboxEntity>

/** The text message of user-1 the receipt holds unless a spec names another body. */
export const ZALO_TEXT_BODY: string = JSON.stringify({
    app_id: "app-1",
    event_name: "user_send_text",
    sender: { id: "user-1" },
    message: { msg_id: "m-1", text: "Hello" },
})

/** A Zalo receipt not processed yet, of connection c-1, holding the text message. */
export const zaloInboxOf: (overrides?: Partial<ZaloInboxEntity>) => ZaloInboxEntity = entityOf(ZaloInboxEntity, {
    id: "receipt-1",
    provider: "zalo",
    payload: { connection: "c-1", rawBody: ZALO_TEXT_BODY },
})

/** A receipt of connection c-1 holding the given raw body, from the given source when it is not the webhook. */
export const zaloInboxWith = (rawBody: string, source?: "poll" | "manual_import"): ZaloInboxEntity =>
    zaloInboxOf({
        payload: source === undefined ? { connection: "c-1", rawBody } : { connection: "c-1", rawBody, source },
    })

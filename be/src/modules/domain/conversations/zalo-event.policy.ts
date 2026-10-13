import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { ZaloInbound } from "./conversations.contracts"
import { ConversationsErrorCode } from "./errors/conversations.error"
import { readJsonObject, textField } from "./inbound-body.policy"

/** The one event the chat answers: a customer writing text to the OA. Everything else (follow, image, seen) is acknowledged and ignored. */
const TEXT_EVENT = "user_send_text"

/** The customer text message of one Zalo event, or a refusal for any other event or one that lacks the sender, the message id or the text. */
export const readZaloEvent = (raw?: Buffer): Outcome<ZaloInbound, ConversationsErrorCode> => {
    const body = readJsonObject(raw)
    if (body.kind !== "ok") return body
    const event = body.value
    const userId = textField(event.sender, "id")
    const messageId = textField(event.message, "msg_id")
    const text = textField(event.message, "text").trim()
    if (textField(event, "event_name") !== TEXT_EVENT || userId === "" || messageId === "" || text === "") {
        return refused(ConversationsErrorCode.NotAnswered)
    }
    return ok({ appId: textField(event, "app_id"), userId, messageId, text })
}

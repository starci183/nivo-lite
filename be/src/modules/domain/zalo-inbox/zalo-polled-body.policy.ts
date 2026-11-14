import type { PolledZaloMessage } from "./zalo-inbox.contracts"

/**
 * The body the webhook would have posted for this message, so the inbox claims it under the same delivery id and the consumer reads it like
 * any delivery. The name the OA's listing shows rides as `sender.display_name` (a member the webhook's body never carries), so the message
 * trigger names the person as the listing does; an empty name is left out.
 */
export const polledRawBody = (message: PolledZaloMessage): Buffer =>
    Buffer.from(
        JSON.stringify({
            event_name: "user_send_text",
            timestamp: String(message.sentAt),
            sender: { id: message.userId, ...(message.userName.trim() === "" ? {} : { display_name: message.userName.trim() }) },
            message: { msg_id: message.messageId, text: message.text },
        }),
    )

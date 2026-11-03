import type { PolledZaloMessage } from "./zalo-inbox.contracts"

/** The body the webhook would have posted for this message, so the inbox claims it under the same delivery id and the consumer reads it like any delivery. */
export const polledRawBody = (message: PolledZaloMessage): Buffer =>
    Buffer.from(
        JSON.stringify({
            event_name: "user_send_text",
            timestamp: String(message.sentAt),
            sender: { id: message.userId },
            message: { msg_id: message.messageId, text: message.text },
        }),
    )

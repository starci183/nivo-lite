import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { chatbotText } from "../copy"
import type { ChatbotCopyKey } from "../copy"

/** A refusal as data: the reason the host acts on and the words the person reads. */
export const refusal = (
    reason: "forbidden" | "conflict" | "refused" | "failed",
    key: ChatbotCopyKey,
): ActionResult => ({
    ok: false,
    reason,
    message: chatbotText(key),
})

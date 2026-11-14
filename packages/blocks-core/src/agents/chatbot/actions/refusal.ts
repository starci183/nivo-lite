import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"
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

/** A write the engine did not make, as a refusal: the record is gone, or its version moved since it was read. */
export const writeRefusal = (result: Extract<EngineResult, { readonly ok: false }>): ActionResult =>
    result.reason === "missing" ? refusal("refused", "reply_not_found") : refusal("conflict", "handling_conflict")

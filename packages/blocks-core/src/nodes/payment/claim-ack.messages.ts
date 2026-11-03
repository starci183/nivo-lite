import type { NodeLocale } from "../node-schema.types"
import type { ClaimAckWords } from "./claim-ack.types"

/** The words of the acknowledgement by language: checking is all they say, never that the money arrived. */
export const CLAIM_ACK_WORDS: Readonly<Record<NodeLocale, ClaimAckWords>> = {
    vi: {
        plain: "Em đang kiểm tra giao dịch của bạn ạ.",
        amount: "Em đang kiểm tra giao dịch {{amount}} của bạn ạ.",
        currency: "đ",
    },
    en: {
        plain: "We are checking your transaction.",
        amount: "We are checking your transaction of {{amount}}.",
        currency: "VND",
    },
}

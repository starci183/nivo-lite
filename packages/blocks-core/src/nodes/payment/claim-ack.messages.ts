import { messageOf } from "../../messages/catalog"
import type { NodeLocale } from "../node-schema.types"
import type { ClaimAckWords } from "./claim-ack.types"

const ackWordsOf = (locale: NodeLocale): ClaimAckWords => ({
    plain: messageOf(locale, "claimAckPlain"),
    amount: messageOf(locale, "claimAckAmount"),
    currency: messageOf(locale, "claimAckCurrency"),
})

/** The words of the acknowledgement by language: checking is all they say, never that the money arrived. */
export const CLAIM_ACK_WORDS: Readonly<Record<NodeLocale, ClaimAckWords>> = {
    vi: ackWordsOf("vi"),
    en: ackWordsOf("en"),
}

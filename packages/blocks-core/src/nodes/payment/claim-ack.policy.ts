import type { NodeLocale } from "../node-schema.types"
import { CLAIM_ACK_WORDS } from "./claim-ack.messages"

/** The neutral reply to a payment claim: it says the transaction is being checked, never that it was received. */
export const claimAckOf = (amountVnd: number | null, locale: NodeLocale): string => {
    const words = CLAIM_ACK_WORDS[locale]
    if (amountVnd === null) return words.plain
    const amount = `${amountVnd.toLocaleString("de-DE")}${words.currency}`
    return words.amount.replace("{{amount}}", amount)
}

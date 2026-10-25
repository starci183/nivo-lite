import type { OfficeMessageStatusView } from "@/modules/types"
import type { OfficeMessageReceipt } from "./office.types"
import type { OfficeWords } from "./office.words"

/**
 * The status under my last line: seen once any member's read marker is past it, delivered once another client fetched it,
 * otherwise sent. A line the back end sends no receipt for is sent.
 */
export const messageStatusOf = (receipt: OfficeMessageReceipt | null, words: OfficeWords): OfficeMessageStatusView => {
    if ((receipt?.seenBy.length ?? 0) > 0) {
        return { kind: "seen", label: words.t("statusSeen"), readers: receipt?.seenBy ?? [] }
    }
    if (receipt?.isDelivered === true) {
        return { kind: "delivered", label: words.t("statusDelivered"), readers: [] }
    }
    return { kind: "sent", label: words.t("statusSent"), readers: [] }
}

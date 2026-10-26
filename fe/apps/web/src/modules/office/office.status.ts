import type { OfficeMessageStatusView } from "@/modules/types"
import type { OfficeMessageReceipt } from "./office.types"
import type { OfficeWords } from "./office.words"

/**
 * The status under my last line: seen once any member's read marker is past it, delivered once another client fetched it,
 * otherwise sent. A line the back end sends no receipt for is sent.
 */
export const messageStatusOf = (receipt: OfficeMessageReceipt | null, words: OfficeWords): OfficeMessageStatusView => {
    if ((receipt?.seenBy.length ?? 0) > 0) {
        const readers = receipt?.seenBy ?? []
        return {
            kind: "seen",
            label: words.t("statusSeen"),
            readers,
            moreReaders: Math.max(0, (receipt?.seenCount ?? 0) - readers.length),
        }
    }
    if (receipt?.isDelivered === true) {
        return { kind: "delivered", label: words.t("statusDelivered"), readers: [], moreReaders: 0 }
    }
    return { kind: "sent", label: words.t("statusSent"), readers: [], moreReaders: 0 }
}

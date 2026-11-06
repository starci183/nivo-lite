import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { FooterZone } from "@starci/grammar/common" with {
    "resolution-mode": "import",
}
import { EMPTY_TAB_COUNTS } from "./filter-tabs"
import type { TabCounts } from "./filter-tabs"
import type { MoreState } from "./rows"

/** The counts the filter tabs draw for the state of the counts read: its counts, zero for each tab when it settled with nothing, none yet while it loads or after it failed. */
export const tabCountsOf = (slot: DataSlot<TabCounts>): TabCounts | null => {
    if ("items" in slot) return slot.items
    return "isEmpty" in slot ? EMPTY_TAB_COUNTS : null
}

/** The words of the footer that loads the next page. */
export interface MoreWords {
    /** The command that loads the next page. */
    readonly loadMore: string
    /** The command that tries a failed page again. */
    readonly retry: string
}

/** The footer zone of the card: the control that loads the next page (the retry after a failure); none when there is no further page. */
export const footersOf = (state: MoreState, words: MoreWords, press: () => void): ReadonlyArray<FooterZone> =>
    state === "none" ? [] : [{ kind: "more", label: state === "failed" ? words.retry : words.loadMore, press }]

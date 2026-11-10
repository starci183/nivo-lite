import type { SlotPanelProps } from "./slot"

/** A list region of the agent profile page (rules, tags, recent work): the card copy, its lines as a slot, and the retry. */
export interface ProfileRegionBaseProps<R> {
    readonly props: {
        readonly label: string
        /** How many things the list holds, as the head's count chip; null for none. */
        readonly count: number | null
        /** The count is work waiting for the owner: the chip is pink, not grey. */
        readonly isAttention: boolean
        /** The head's one navigation link ("Xem tat ca" then the arrow); null for none. */
        readonly action: { readonly label: string; readonly href: string } | null
        readonly read: SlotPanelProps<R>
    }
    readonly on: { readonly retry: () => void }
}

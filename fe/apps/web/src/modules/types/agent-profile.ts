import type { SlotPanelProps } from "./slot"

/** A list region of the agent profile page (rules, tags, recent work): the card copy, its lines as a slot, and the retry. */
export interface ProfileRegionBaseProps<R> {
    readonly props: {
        readonly label: string
        /** A line under the list; null for none. */
        readonly footer: string | null
        readonly read: SlotPanelProps<R>
    }
    readonly on: { readonly retry: () => void }
}

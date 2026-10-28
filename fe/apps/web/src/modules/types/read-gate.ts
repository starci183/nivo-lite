import type { ReactNode } from "react"
import type { DataSlot, SlotLabels } from "./slot"

/** What a read gate's pure half takes: the blocks behind it, the read they wait for, and the name of their panel. */
export interface ReadGateBaseProps<T> {
    /** The blocks behind the gate. */
    readonly shape: { readonly content: ReactNode }
    readonly props: {
        /** The read the blocks behind the gate wait for: its items are not drawn here, the gate only waits for them. */
        readonly slot: DataSlot<T>
        readonly slotLabels: SlotLabels
        /** The name of the panel behind the gate, the label of its skeleton card while the read waits. */
        readonly placeholder: string
    }
    readonly on: { readonly retry: () => void }
}

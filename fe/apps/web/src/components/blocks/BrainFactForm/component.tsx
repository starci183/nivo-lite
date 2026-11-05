import { FactFormDrawer } from "@/components/frames/FactFormDrawer"
import type { FactDrawerView } from "@/modules/types"

/** Props for {@link BrainFactFormBase}: the drawer that writes a fact. */
export interface BrainFactFormBaseProps {
    readonly props: FactDrawerView["props"]
    readonly on: FactDrawerView["on"]
}

/** Draws the drawer that writes a fact, or a new value for one in force. */
export const BrainFactFormBase = (props: BrainFactFormBaseProps) => <FactFormDrawer {...props} />

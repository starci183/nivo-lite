import type { ReactNode } from "react"
import { PanelGate } from "@/components/composites/PanelGate"
import type { PanelGateProps } from "@/components/composites/PanelGate"

/** Props for {@link SalesWorkbenchGateBase}. */
export interface SalesWorkbenchGateBaseProps {
    /** The blocks behind the gate. */
    readonly state: { readonly content: ReactNode }
    readonly props: Omit<PanelGateProps, "content">
}

/** Draws the blocks that need the Sales workbench once it is read, or the skeleton of their panel meanwhile. */
export const SalesWorkbenchGateBase = (props: SalesWorkbenchGateBaseProps) => (
    <PanelGate {...props.props} content={props.state.content} />
)

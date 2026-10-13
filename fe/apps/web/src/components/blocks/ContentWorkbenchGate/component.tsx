import type { ReactNode } from "react"
import { PanelGate } from "@/components/composites/PanelGate"
import type { PanelGateProps } from "@/components/composites/PanelGate"

/** Props for {@link ContentWorkbenchGateBase}. */
export interface ContentWorkbenchGateBaseProps {
    /** The blocks behind the gate. */
    readonly state: { readonly content: ReactNode }
    readonly props: Omit<PanelGateProps, "content">
}

/** Draws the blocks that need the content workbench once it is read, or the skeleton of their panel meanwhile. */
export const ContentWorkbenchGateBase = (props: ContentWorkbenchGateBaseProps) => (
    <PanelGate {...props.props} content={props.state.content} />
)

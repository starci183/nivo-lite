import type { ReactNode } from "react"
import { AgentInstanceFrame } from "@/components/blocks/AgentInstanceFrame"
import type { ModuleKey } from "@/modules/catalog"

/** What the layout supplies: the type and the instance of the url. */
export interface AgentInstanceLayoutBaseProps {
    readonly props: { readonly module: ModuleKey; readonly installationId: string }
    /** The routed tab drawn inside the frame. */
    readonly children?: ReactNode
}

/** Draws the frame of an agent instance: the one connected block that holds the band with the agent switcher and the routed tab. */
export const AgentInstanceLayoutBase = (props: AgentInstanceLayoutBaseProps) => (
    <AgentInstanceFrame module={props.props.module} installationId={props.props.installationId}>
        {props.children}
    </AgentInstanceFrame>
)

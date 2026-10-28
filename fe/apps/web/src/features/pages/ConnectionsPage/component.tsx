import { ConnectionsFrame } from "@/components/blocks/ConnectionsFrame"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectionsOverlayHost, ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"

/** What the Connections page supplies: the tab the query string asked for. */
export interface ConnectionsPageBaseProps {
    readonly props: {
        readonly tab: string | undefined
    }
}

/** Draws the Connections page: the frame's `Page` around the board, with the wizard and connector detail drawers inside it. */
export const ConnectionsPageBase = (props: ConnectionsPageBaseProps) => (
    <ConnectionsFrame tab={props.props.tab}>
        <ConnectionsOverlayHost
            tab={props.props.tab}
            candidate={
                <>
                    <ConnectionWizardOverlay />
                    <ConnectorDetailOverlay />
                </>
            }
        />
    </ConnectionsFrame>
)

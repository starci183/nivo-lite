import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectionsOverlayHost, ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"

/** What the Connections page supplies: the tab the query string asked for. */
export interface ConnectionsPageBaseProps {
    readonly props: {
        readonly tab: string | undefined
    }
}

/** Draws the Connections page: the board with the wizard and connector detail drawers over it. */
export const ConnectionsPageBase = (props: ConnectionsPageBaseProps) => (
    <ConnectionsOverlayHost
        tab={props.props.tab}
        candidate={
            <>
                <ConnectionWizardOverlay />
                <ConnectorDetailOverlay />
            </>
        }
    />
)

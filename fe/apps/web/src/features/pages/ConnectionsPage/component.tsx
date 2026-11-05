import { ConnectionLibrary } from "@/components/blocks/ConnectionLibrary"
import { ConnectionOpen } from "@/components/blocks/ConnectionOpen"
import { ConnectionsHome } from "@/components/blocks/ConnectionsHome"
import { McpGatewaySection } from "@/components/blocks/McpGatewaySection"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectionsOverlayHost, ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"

/** What the Connections page supplies: the tab the query string asked for. */
export interface ConnectionsPageBaseProps {
    readonly props: {
        readonly tab: string | undefined
        /** The connection without a page of its own that the address opens. */
        readonly open: string | undefined
    }
}

/**
 * Draws the page beside the list of connections: the overview, or the connector library with the MCP gateway under it, and the
 * wizard and connector drawers the address opens.
 */
export const ConnectionsPageBase = (props: ConnectionsPageBaseProps) => (
    <>
        {props.props.tab === "library" ? (
            <>
                <ConnectionLibrary />
                <McpGatewaySection isEnabled />
            </>
        ) : (
            <>
                {props.props.open === undefined ? (
                    <ConnectionsHome />
                ) : (
                    <ConnectionOpen connectionId={props.props.open} />
                )}
            </>
        )}
        <ConnectionsOverlayHost
            candidate={
                <>
                    <ConnectionWizardOverlay />
                    <ConnectorDetailOverlay />
                </>
            }
        />
    </>
)

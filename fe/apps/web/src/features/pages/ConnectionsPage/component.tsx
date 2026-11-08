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

/** The body beside the list of connections: the connector library with the MCP gateway, the connection the address opens, or the overview. */
const ConnectionsBody = (props: ConnectionsPageBaseProps) => {
    if (props.props.tab === "library") {
        return (
            <>
                <ConnectionLibrary />
                <McpGatewaySection isEnabled />
            </>
        )
    }
    if (props.props.open === undefined) return <ConnectionsHome />
    return <ConnectionOpen connectionId={props.props.open} />
}

/**
 * Draws the page beside the list of connections: the overview, or the connector library with the MCP gateway under it, and the
 * wizard and connector drawers the address opens.
 */
export const ConnectionsPageBase = (props: ConnectionsPageBaseProps) => (
    <>
        <ConnectionsBody {...props} />
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

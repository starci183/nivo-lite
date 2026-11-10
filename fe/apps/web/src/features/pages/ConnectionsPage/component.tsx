import { Stack } from "@starci/grammar/common"
import { ConnectionLibrary } from "@/components/blocks/ConnectionLibrary"
import { ConnectionsHome } from "@/components/blocks/ConnectionsHome"
import { McpGatewaySection } from "@/components/blocks/McpGatewaySection"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectionsOverlayHost, ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"

/** What the Connections page supplies: the tab the query string asked for. */
export interface ConnectionsPageBaseProps {
    readonly props: {
        readonly tab: string | undefined
    }
}

/**
 * Draws the open tab of the Connections page under the band its layout draws: the connections (what needs the owner, the health
 * figures, every connection), or the connector library with the MCP gateway under it; and the wizard and connector drawers the
 * address opens.
 */
export const ConnectionsPageBase = (props: ConnectionsPageBaseProps) => (
    <>
        {props.props.tab === "library" ? (
            <Stack gap="region">
                <ConnectionLibrary />
                <McpGatewaySection isEnabled />
            </Stack>
        ) : (
            <ConnectionsHome />
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

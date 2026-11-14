import type { ReactElement } from "react"
import { ProviderConfigTab } from "@/components/blocks/ProviderConfigTab"
import { ProviderApiTab } from "@/components/blocks/ProviderApiTab"
import { ProviderMcpTab } from "@/components/blocks/ProviderMcpTab"
import { ProviderRightsTab } from "@/components/blocks/ProviderRightsTab"
import { ProviderTriggerTab } from "@/components/blocks/ProviderTriggerTab"
import type { ProviderPageTab } from "@/modules/types"

/** What the page owner supplies: the tab the address opens. */
export interface ConnectionOpenPageBaseProps {
    readonly props: { readonly tab: ProviderPageTab; readonly connectionId: string }
}

/**
 * Draws the body of the one provider page template a connected account opens on (the layout draws the band and the tabs
 * Config, Rights, API, MCP, Trigger): each tab is one block.
 */
export const ConnectionOpenPageBase = (props: ConnectionOpenPageBaseProps): ReactElement => {
    switch (props.props.tab) {
        case "config":
            return <ProviderConfigTab connectionId={props.props.connectionId} />
        case "rights":
            return <ProviderRightsTab />
        case "api":
            return <ProviderApiTab connectionId={props.props.connectionId} />
        case "mcp":
            return <ProviderMcpTab />
        case "trigger":
            return <ProviderTriggerTab />
    }
}

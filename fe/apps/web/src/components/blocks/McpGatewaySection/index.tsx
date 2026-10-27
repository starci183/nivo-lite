"use client"

import { useMcpGatewayView } from "@/hooks/mcpGateway"
import { McpGatewaySectionBase } from "./component"

/** What the Connections board hands the gateway section. */
interface McpGatewaySectionProps {
    /** The region is read, and drawn, for a manager once the board is ready. */
    readonly isEnabled: boolean
}

/** The workspace's MCP gateway: its three cards and the form that registers a connector, read once the board is ready. */
export const McpGatewaySection = (props: McpGatewaySectionProps) => {
    const gateway = useMcpGatewayView(props.isEnabled)
    if (!gateway.isShown) return null
    return (
        <McpGatewaySectionBase
            props={{ label: gateway.label, slot: gateway.slot, slotLabels: gateway.labels, forms: gateway.forms }}
            on={{ ...gateway.on, retry: gateway.onRetry }}
        />
    )
}

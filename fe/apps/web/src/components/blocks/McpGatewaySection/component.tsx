import type { ComponentProps } from "react"
import { McpConnectorForms } from "@/components/composites/McpConnectorForms"
import { McpGatewayRegion } from "@/components/composites/McpGatewayRegion"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The cards the gateway region draws. */
type GatewayView = ComponentProps<typeof McpGatewayRegion>["view"]

/** The cards of the gateway, the register form and the commands of both. */
export interface McpGatewaySectionBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<GatewayView>
        readonly slotLabels: SlotLabels
        readonly forms: ComponentProps<typeof McpConnectorForms>["props"]
    }
    readonly on: ComponentProps<typeof McpConnectorForms>["on"] & { readonly retry: () => void }
}

/** Draws one gateway card of the region, or its placeholder while the reads are on their way. */
const renderCards = (view: GatewayView, isSkeleton: boolean) => <McpGatewayRegion view={view} isSkeleton={isSkeleton} />

/** The MCP gateway cards, and the forms that register a connector once the cards are in. */
export const McpGatewaySectionBase = (props: McpGatewaySectionBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={{ cards: [{ label: props.props.label, rows: [], emptyMessage: "", emptyDescription: "" }] }}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {renderCards}
        </SlotView>
        {props.props.slot.items === undefined ? null : <McpConnectorForms props={props.props.forms} on={props.on} />}
    </>
)

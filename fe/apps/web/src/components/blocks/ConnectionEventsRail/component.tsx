import { Badge, Cluster, PaneSection, Text } from "@starci/grammar/common"
import { CONNECTION_LINES_PLACEHOLDER, ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@/components/composites/SlotView"
import type { ConnectionLineView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy and slot of the live rail. */
export interface ConnectionEventsRailBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        /** How the rail keeps itself current, under the list. */
        readonly footnote: string
        readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the live rail of a provider page as the bands of its pane: the heading with the live mark, the lines newest first, the footnote. */
export const ConnectionEventsRailBase = (props: ConnectionEventsRailBaseProps) => (
    <>
        <PaneSection>
            <SlotView
                slot={props.props.lines}
                placeholder={CONNECTION_LINES_PLACEHOLDER}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(lines, isSkeleton) => (
                    <ConnectionLines label={props.props.title} isSkeleton={isSkeleton} lines={lines} />
                )}
            />
        </PaneSection>
        <PaneSection as="footer">
            <Cluster gap="inline">
                <Badge isDot tone="success">
                    {props.props.liveLabel}
                </Badge>
                <Text size="xs" tone="muted">
                    {props.props.footnote}
                </Text>
            </Cluster>
        </PaneSection>
    </>
)

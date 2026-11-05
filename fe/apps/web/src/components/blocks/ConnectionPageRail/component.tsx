import { Badge, Cluster, Heading, PaneSection, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_LINES_PLACEHOLDER, ConnectionLines } from "@/components/composites/ConnectionLines"
import type { ConnectionLineView, DataSlot, SlotLabels } from "@/modules/types"

/** The live rail of a provider page: the heading with the live mark, the lines newest first, the footnote. */
export interface ConnectionPageRailBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        readonly footnote: string
        readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the live rail as the bands of its pane: the heading with the live mark, the lines newest first, the footnote. */
export const ConnectionPageRailBase = (props: ConnectionPageRailBaseProps) => (
    <>
        <PaneSection as="header">
            <Cluster gap="inline" justify="between">
                <Heading level={2}>{props.props.title}</Heading>
                <Badge isDot tone="success">
                    {props.props.liveLabel}
                </Badge>
            </Cluster>
        </PaneSection>
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
            <Text size="xs" tone="muted">
                {props.props.footnote}
            </Text>
        </PaneSection>
    </>
)

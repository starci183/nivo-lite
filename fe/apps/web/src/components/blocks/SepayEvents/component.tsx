import { Badge, List, PaneSection, SectionHeader, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { StatusRows } from "@/components/composites/StatusRows"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One delivery as it is worded. */
export interface SepayEventRow {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly detail: string
}

/** Props for {@link SepayEventsBase}. */
export interface SepayEventsBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        /** How the rail keeps itself current, under the list. */
        readonly footnote: string
        readonly slot: DataSlot<ReadonlyArray<SepayEventRow>>
        readonly placeholder: ReadonlyArray<SepayEventRow>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

const rowsOf = (events: ReadonlyArray<SepayEventRow>) =>
    events.map((event) => ({
        id: event.id,
        title: event.title,
        note: (
            <Text size="xs" tone="muted">
                {event.detail}
            </Text>
        ),
        badgeLabel: event.statusLabel,
        badgeTone: event.statusTone,
    }))

/** Draws the live rail of webhook deliveries as the bands of its pane: the heading with the live mark, the deliveries newest first, the footnote. */
export const SepayEventsBase = (props: SepayEventsBaseProps) => (
    <>
        <PaneSection as="header">
            <SectionHeader
                level={2}
                title={props.props.title}
                meta={
                    <Badge isDot tone="success">
                        {props.props.liveLabel}
                    </Badge>
                }
            />
        </PaneSection>
        <PaneSection>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
            >
                {(events, isSkeleton) => (
                    <List label={props.props.title} aria-busy={isSkeleton}>
                        <StatusRows rows={rowsOf(events)} isSkeleton={isSkeleton} />
                    </List>
                )}
            </SlotView>
        </PaneSection>
        <PaneSection as="footer">
            <Text size="xs" tone="muted">
                {props.props.footnote}
            </Text>
        </PaneSection>
    </>
)

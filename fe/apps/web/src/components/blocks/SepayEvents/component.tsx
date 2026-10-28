import { Badge, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { StatusRows } from "@/components/composites/StatusRows"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { sepayEventsClassNames as classNames } from "./classNames"

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

/** Draws the docked live panel of webhook deliveries, newest first. */
export const SepayEventsBase = (props: SepayEventsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Badge isDot tone="success">
            {props.props.liveLabel}
        </Badge>
        <SlotView {...props.props} onRetry={props.on.retry}>
            {(events, isSkeleton) => (
                <div className={classNames.list}>
                    <StatusRows rows={rowsOf(events)} isSkeleton={isSkeleton} />
                </div>
            )}
        </SlotView>
    </SurfaceCard>
)

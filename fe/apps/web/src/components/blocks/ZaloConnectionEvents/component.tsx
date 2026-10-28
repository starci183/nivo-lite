import { Badge, ListRow } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ZaloSection } from "@/components/composites/ZaloSection"
import type { DataSlot, SlotLabels, ZaloEventLineView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_EVENTS_PLACEHOLDER: ReadonlyArray<ZaloEventLineView> = [
    { id: "one", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "two", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "three", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
]

/** Copy and slot of the live panel. */
export interface ZaloConnectionEventsBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        readonly events: DataSlot<ReadonlyArray<ZaloEventLineView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the live Zalo events panel: the recent events of the OA, newest first, under a live mark. */
export const ZaloConnectionEventsBase = (props: ZaloConnectionEventsBaseProps) => (
    <SlotView
        slot={props.props.events}
        placeholder={ZALO_EVENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(events, isSkeleton) => (
            <ZaloSection
                title={props.props.title}
                isSkeleton={isSkeleton}
                end={
                    <Badge isDot tone="success" isSkeleton={isSkeleton}>
                        {props.props.liveLabel}
                    </Badge>
                }
            >
                {events.map((event) => (
                    <ListRow
                        key={event.id}
                        title={event.title}
                        description={event.detail}
                        isSkeleton={isSkeleton}
                        badges={
                            <Badge tone={event.outcomeTone} isSkeleton={isSkeleton}>
                                {event.outcomeLabel}
                            </Badge>
                        }
                    />
                ))}
            </ZaloSection>
        )}
    </SlotView>
)

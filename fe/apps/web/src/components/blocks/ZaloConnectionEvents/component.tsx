import { Badge, PaneSection, SectionHeader, Text } from "@starci/grammar/common"
import { ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloEventLineView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_EVENTS_PLACEHOLDER: ReadonlyArray<ZaloEventLineView> = [
    { id: "one", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "two", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "three", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
]

/** Copy and slot of the live rail. */
export interface ZaloConnectionEventsBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        /** How the rail keeps itself current, under the list. */
        readonly footnote: string
        readonly events: DataSlot<ReadonlyArray<ZaloEventLineView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the live Zalo events rail as the bands of its pane: the heading with the live mark, the events newest first, the footnote. */
export const ZaloConnectionEventsBase = (props: ZaloConnectionEventsBaseProps) => (
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
                slot={props.props.events}
                placeholder={ZALO_EVENTS_PLACEHOLDER}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
            >
                {(events, isSkeleton) => (
                    <ConnectionLines
                        label={props.props.title}
                        isSkeleton={isSkeleton}
                        lines={events.map((event) => ({
                            id: event.id,
                            title: event.title,
                            description: event.detail,
                            badge: { label: event.outcomeLabel, tone: event.outcomeTone },
                        }))}
                    />
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

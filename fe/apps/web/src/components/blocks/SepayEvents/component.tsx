import { Badge, EmptyNotice, PaneSection, Section, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
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

/** One unpainted collection owns the rail heading, live cue and loading rows; the source note stays in its footer band. */
export const SepayEventsBase = (props: SepayEventsBaseProps) => (
    <>
        <PaneSection>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(events, isSkeleton) => (
                    <Section
                        kind="list"
                        title={props.props.title}
                        isLoading={isSkeleton}
                        action={
                            <Badge isDot tone="success">
                                {props.props.liveLabel}
                            </Badge>
                        }
                        items={events.map((event) => ({
                            id: event.id,
                            title: event.title,
                            description: event.detail,
                            badges: [{ label: event.statusLabel, tone: event.statusTone }] as const,
                        }))}
                        empty={<EmptyNotice message={props.props.labels.empty} />}
                    />
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

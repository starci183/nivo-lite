import { Badge, EmptyNotice, PaneSection, Section, Text, type BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One delivery of the live rail as it is worded. */
interface SepayEventRow {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly detail: string
}

/** The live webhook rail of a SePay connection. */
export interface SepayRailBaseProps {
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

/** The live rail: the deliveries newest first with the live cue, and the source note in its footer band. */
export const SepayRailBase = (props: SepayRailBaseProps) => (
    <>
        <PaneSection>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(rows, isSkeleton) => (
                    <Section
                        kind="list"
                        title={props.props.title}
                        isLoading={isSkeleton}
                        action={
                            <Badge isDot tone="success">
                                {props.props.liveLabel}
                            </Badge>
                        }
                        items={rows.map((event) => ({
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

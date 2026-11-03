import { Stack, SurfaceCard, Text, Timeline, Section, type TimelineItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { LeadMark } from "@/components/composites/LeadMark"
import { HISTORY_ANCHOR_CLASS_NAME } from "./classNames"
import type { LeadIcon, DataSlot, SlotLabels } from "@/modules/types"

/** One line of the audit trail, already resolved to text. */
export interface HistoryEntryView {
    readonly id: string
    readonly actor: string
    readonly dateTime: string
    readonly timeLabel: string
    readonly icon: LeadIcon
    readonly kindLabel: string
    readonly summary: string
    readonly evidence: string | null
    readonly isOpen: boolean
}

/** What the section shows about one lead. */
export interface HistoryView {
    readonly meta: string
    readonly entries: ReadonlyArray<HistoryEntryView>
}

/** The words of the section. */
export interface HistoryLabels {
    readonly title: string
    readonly timelineLabel: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly auditNote: string
    readonly evidenceLabel: string
    readonly slot: SlotLabels
}

/** The words and data of the history section. */
export interface LeadHistoryBaseProps {
    readonly props: {
        readonly slot: DataSlot<HistoryView>
        readonly entriesSlot: DataSlot<ReadonlyArray<HistoryEntryView>>
        readonly labels: HistoryLabels
    }
    readonly on: {
        readonly retry: () => void
        readonly toggle: (entryId: string, isOpen: boolean) => void
    }
}

const PLACEHOLDER: HistoryView = { meta: "", entries: [] }

/** One evidence disclosure, kept outside the collection loop so its typed items have one owner. */
interface EvidenceDisclosureProps {
    readonly entry: HistoryEntryView
    readonly label: string
    readonly onToggle: LeadHistoryBaseProps["on"]["toggle"]
}

const EvidenceDisclosure = (props: EvidenceDisclosureProps) => (
    <SurfaceCard
        kind="accordion"
        ariaLabel={props.label}
        items={[
            {
                id: props.entry.id,
                title: props.label,
                isOpen: props.entry.isOpen,
                body: (
                    <Text as="p" size="sm">
                        {props.entry.evidence}
                    </Text>
                ),
            },
        ]}
        onItemOpenChange={props.onToggle}
    />
)

/** The existing timeline anatomy for one settled history entry. */
const historyItemOf = (
    entry: HistoryEntryView,
    labels: HistoryLabels,
    on: LeadHistoryBaseProps["on"],
): TimelineItem => ({
    id: entry.id,
    title: entry.actor,
    dateTime: entry.dateTime,
    timeLabel: entry.timeLabel,
    marker: <LeadMark icon={entry.icon} />,
    description: (
        <Stack gap="identity">
            <Text as="p" size="xs" tone="muted" isStrong>
                {entry.kindLabel}
            </Text>
            <Text as="p" size="sm">
                {entry.summary}
            </Text>
            {entry.evidence ? (
                <EvidenceDisclosure entry={entry} label={labels.evidenceLabel} onToggle={on.toggle} />
            ) : null}
        </Stack>
    ),
})

/** The append-only audit trail; each read status remains in the canonical slot recipe. */
export const LeadHistoryBase = (props: LeadHistoryBaseProps) => {
    const p = props.props,
        labels = p.labels
    return (
        <div id="history" className={HISTORY_ANCHOR_CLASS_NAME}>
            <SlotView
                slot={p.slot}
                placeholder={PLACEHOLDER}
                labels={labels.slot}
                onRetry={props.on.retry}
                render={(view, isLoading) => (
                    <Section title={labels.title} meta={view.meta} isLoading={isLoading}>
                        <SlotView
                            slot={p.entriesSlot}
                            placeholder={[]}
                            labels={{ ...labels.slot, empty: labels.emptyTitle }}
                            emptyDescription={labels.emptyHint}
                            onRetry={props.on.retry}
                            render={(entries, isLoading) => (
                                <Timeline
                                    label={labels.timelineLabel}
                                    isLoading={isLoading}
                                    items={entries.map((entry) => historyItemOf(entry, labels, props.on))}
                                />
                            )}
                        />
                        <Text as="p" size="xs" tone="muted">
                            {labels.auditNote}
                        </Text>
                    </Section>
                )}
            />
        </div>
    )
}

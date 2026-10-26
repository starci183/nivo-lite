import { EmptyNotice, Region, SectionHeader, SurfaceAccordionCard, Text, Timeline } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { LeadMark } from "@/components/composites/LeadMark"
import { ENTRY_STACK_CLASS_NAME, HISTORY_ANCHOR_CLASS_NAME } from "./classNames"
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
        readonly labels: HistoryLabels
    }
    readonly on: {
        readonly toggle: (entryId: string, isOpen: boolean) => void
    }
}

const PLACEHOLDER: HistoryView = { meta: "", entries: [] }

/** The append-only audit trail of a lead, oldest first so the latest sits at the bottom; entries with evidence expand to show it. */
export const LeadHistoryBase = (props: LeadHistoryBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    return (
        <Region id="history" labelledBy="history-title" className={HISTORY_ANCHOR_CLASS_NAME}>
            <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
                {(view, isSkeleton) => (
                    <>
                        <SectionHeader
                            id="history-title"
                            level={2}
                            title={l.title}
                            meta={isSkeleton ? undefined : view.meta}
                        />
                        {isSkeleton ? <Timeline label={l.title} items={[]} isLoading loadingRows={3} /> : null}
                        {!isSkeleton && view.entries.length === 0 ? (
                            <EmptyNotice message={l.emptyTitle} description={l.emptyHint} />
                        ) : null}
                        {!isSkeleton && view.entries.length > 0 ? (
                            <Timeline
                                label={l.timelineLabel}
                                items={view.entries.map((entry) => ({
                                    id: entry.id,
                                    title: entry.actor,
                                    dateTime: entry.dateTime,
                                    timeLabel: entry.timeLabel,
                                    marker: <LeadMark icon={entry.icon} />,
                                    description: (
                                        <div className={ENTRY_STACK_CLASS_NAME}>
                                            <Text as="p" size="xs" tone="muted" weight="medium">
                                                {entry.kindLabel}
                                            </Text>
                                            <Text as="p" size="sm">
                                                {entry.summary}
                                            </Text>
                                            {entry.evidence ? (
                                                <SurfaceAccordionCard
                                                    isOpen={entry.isOpen}
                                                    onOpenChange={(isOpen) => on.toggle(entry.id, isOpen)}
                                                    summaryRender={l.evidenceLabel}
                                                    bodyRender={entry.evidence}
                                                    renderSummary={(summary) => (
                                                        <Text size="sm" weight="medium">
                                                            {summary}
                                                        </Text>
                                                    )}
                                                    renderBody={(body) => (
                                                        <Text as="p" size="sm">
                                                            {body}
                                                        </Text>
                                                    )}
                                                />
                                            ) : null}
                                        </div>
                                    ),
                                }))}
                            />
                        ) : null}
                        <Text as="p" size="xs" tone="muted">
                            {l.auditNote}
                        </Text>
                    </>
                )}
            </SlotView>
        </Region>
    )
}

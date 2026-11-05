import { Disclosure, Stack, SurfaceCard, Text, Timeline } from "@starci/grammar/common"
import type { TimelineItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { LeadMark } from "@/components/composites/LeadMark"
import type { LeadPanesOn, LeadTimelineEntryView, LeadTimelineView, SlotLabels, DataSlot } from "@/modules/types"

/** What the activity trail draws. */
interface LeadTimelineSectionProps {
    readonly slot: DataSlot<LeadTimelineView>
    readonly labels: {
        readonly title: string
        readonly timelineLabel: string
        readonly emptyHint: string
        readonly auditNote: string
        readonly evidenceLabel: string
        readonly slot: SlotLabels
    }
    readonly on: Pick<LeadPanesOn, "timelineRetry" | "timelineToggle">
}

const PLACEHOLDER: LeadTimelineView = {
    meta: "",
    entries: ["a", "b", "c"].map((id) => ({
        id,
        dateTime: "",
        timeLabel: "",
        icon: "pending" as const,
        title: "",
        summary: "",
        evidence: null,
        isOpen: false,
    })),
}

/** One entry: who and when, what happened, what it says and the evidence behind it when there is some. */
const itemOf = (entry: LeadTimelineEntryView, props: LeadTimelineSectionProps): TimelineItem => ({
    id: entry.id,
    title: entry.title,
    ...(entry.dateTime === "" ? {} : { dateTime: entry.dateTime }),
    timeLabel: entry.timeLabel,
    marker: <LeadMark icon={entry.icon} />,
    description: (
        <Stack gap="identity">
            <Text as="p" size="sm">
                {entry.summary}
            </Text>
            {entry.evidence === null || entry.evidence === "" ? null : (
                <Disclosure
                    title={props.labels.evidenceLabel}
                    headingLevel={3}
                    isExpanded={entry.isOpen}
                    onExpandedChange={(isOpen) => props.on.timelineToggle(entry.id, isOpen)}
                    body={
                        <Text as="p" size="sm">
                            {entry.evidence}
                        </Text>
                    }
                />
            )}
        </Stack>
    ),
})

/** The activity trail of the main pane: events and earlier steps in one timeline, and the note that the log only grows. */
export const LeadTimelineSection = (props: LeadTimelineSectionProps) => (
    <SlotView
        slot={props.slot}
        placeholder={PLACEHOLDER}
        labels={props.labels.slot}
        emptyDescription={props.labels.emptyHint}
        onRetry={props.on.timelineRetry}
        render={(view, isLoading) => (
            <div id="history">
                <SurfaceCard
                    label={props.labels.title}
                    headingLevel={2}
                    fact={view.meta}
                    footer={props.labels.auditNote}
                    isLoading={isLoading}
                >
                    <Timeline
                        label={props.labels.timelineLabel}
                        isLoading={isLoading}
                        items={view.entries.map((entry) => itemOf(entry, props))}
                    />
                </SurfaceCard>
            </div>
        )}
    />
)

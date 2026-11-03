import { EmptyNotice, Section, Stack, Text, type ListRowData } from "@starci/grammar/common"
import { LeadPanel } from "@/components/frames/LeadPanel"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, FlowEntryView, FlowView, SlotLabels } from "@/modules/types"

/** The words of the work flow card. */
export interface FlowLabels {
    readonly title: string
    readonly stepsTitle: string
    readonly stepsEmptyTitle: string
    readonly stepsEmptyHint: string
    readonly slot: SlotLabels
}

/** The words and data of the work flow card. */
export interface LeadWorkFlowBaseProps {
    readonly props: {
        readonly slot: DataSlot<FlowView>
        readonly labels: FlowLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

const PLACEHOLDER_ENTRY: FlowEntryView = { id: "step", head: "…", when: null, badge: null, reason: null, lines: [] }

const PLACEHOLDER: FlowView = {
    fact: "",
    steps: [
        { ...PLACEHOLDER_ENTRY, id: "step-1" },
        { ...PLACEHOLDER_ENTRY, id: "step-2" },
        { ...PLACEHOLDER_ENTRY, id: "step-3" },
    ],
    sections: [],
}

/** One entry: what happened, when, how it stands and the lines that qualify it. */
const entryOf = (entry: FlowEntryView): ListRowData => ({
    id: entry.id,
    title: entry.head,
    description: [entry.when?.label, entry.reason].filter((value) => value !== null && value !== undefined).join(" · "),
    ...(entry.badge === null ? {} : { badges: [{ label: entry.badge.label, tone: entry.badge.tone }] }),
    detail: (
        <Stack gap="identity">
            {entry.lines.map((line) => (
                <Text
                    key={line.id}
                    as="p"
                    size={line.strong ? "sm" : "xs"}
                    {...(line.strong ? {} : { tone: "muted" as const })}
                >
                    {line.text}
                </Text>
            ))}
        </Stack>
    ),
})

/** The work flow card: the AI work items of this lead in order, then its orders, invoices, payments and decisions. */
export const LeadWorkFlowBase = (props: LeadWorkFlowBaseProps) => {
    const { props: p, on } = props
    return (
        <LeadPanel anchor="flow" label={p.labels.title}>
            <SlotView
                slot={p.slot}
                placeholder={PLACEHOLDER}
                labels={p.labels.slot}
                onRetry={on.retry}
                render={(view, isSkeleton) => (
                    <Stack gap="section">
                        <Section
                            kind="list"
                            title={p.labels.stepsTitle}
                            headingLevel={3}
                            isLoading={isSkeleton}
                            items={view.steps.map(entryOf)}
                            empty={
                                <EmptyNotice message={p.labels.stepsEmptyTitle} description={p.labels.stepsEmptyHint} />
                            }
                        />
                        {view.sections.map((section) => (
                            <Section
                                key={section.id}
                                kind="list"
                                title={section.title}
                                headingLevel={3}
                                items={section.entries.map(entryOf)}
                                empty={<EmptyNotice message={section.emptyText} />}
                            />
                        ))}
                    </Stack>
                )}
            />
        </LeadPanel>
    )
}

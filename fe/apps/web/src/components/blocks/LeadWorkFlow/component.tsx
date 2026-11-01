import { Badge, Cluster, EmptyNotice, Heading, List, ListItem, Stack, Text } from "@starci/grammar/common"
import { LeadPanel } from "@/components/composites/LeadPanel"
import { SlotView } from "@/components/composites/SlotView"
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

/** One entry and whether it draws as a skeleton. */
type EntryRowProps = {
    readonly entry: FlowEntryView
    readonly isSkeleton: boolean
}

/** One entry: what happened, when, how it stands and the lines that qualify it. */
const EntryRow = (props: EntryRowProps) => (
    <ListItem>
        <Stack gap="identity">
            <Cluster gap="inline" align="baseline" justify="between">
                <Text as="span" size="sm" weight="medium" isSkeleton={props.isSkeleton}>
                    {props.entry.head}
                </Text>
                {props.entry.when === null ? null : (
                    <Text as="span" size="xs" tone="muted">
                        <time dateTime={props.entry.when.iso}>{props.entry.when.label}</time>
                    </Text>
                )}
                {props.entry.badge === null ? null : (
                    <Badge tone={props.entry.badge.tone}>{props.entry.badge.label}</Badge>
                )}
            </Cluster>
            {props.entry.reason === null ? null : (
                <Cluster gap="inline">
                    <Badge tone="neutral">{props.entry.reason}</Badge>
                </Cluster>
            )}
            {props.entry.lines.map((line) => (
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
    </ListItem>
)

/** The work flow card: the AI work items of this lead in order, then its orders, invoices, payments and decisions. */
export const LeadWorkFlowBase = (props: LeadWorkFlowBaseProps) => {
    const { props: p, on } = props
    return (
        <LeadPanel anchor="flow" label={p.labels.title}>
            <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={p.labels.slot} onRetry={on.retry}>
                {(view, isSkeleton) => (
                    <Stack gap="region">
                        <Stack gap="row">
                            <Heading level={3}>{p.labels.stepsTitle}</Heading>
                            {view.steps.length === 0 ? (
                                <EmptyNotice message={p.labels.stepsEmptyTitle} description={p.labels.stepsEmptyHint} />
                            ) : (
                                <List as="ol" label={p.labels.stepsTitle}>
                                    {view.steps.map((entry) => (
                                        <EntryRow key={entry.id} entry={entry} isSkeleton={isSkeleton} />
                                    ))}
                                </List>
                            )}
                        </Stack>
                        {view.sections.map((section) => (
                            <Stack key={section.id} gap="row">
                                <Heading level={3}>{section.title}</Heading>
                                {section.entries.length === 0 ? (
                                    <Text as="p" size="xs" tone="muted">
                                        {section.emptyText}
                                    </Text>
                                ) : (
                                    <List label={section.title}>
                                        {section.entries.map((entry) => (
                                            <EntryRow key={entry.id} entry={entry} isSkeleton={false} />
                                        ))}
                                    </List>
                                )}
                            </Stack>
                        ))}
                    </Stack>
                )}
            </SlotView>
        </LeadPanel>
    )
}

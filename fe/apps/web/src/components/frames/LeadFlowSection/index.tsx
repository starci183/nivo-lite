import { Badge, Cluster, DescriptionList, Section, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, FlowEntryView, LeadPanesOn, FlowView, SlotLabels } from "@/modules/types"

/** What the orders-and-payments region draws. */
interface LeadFlowSectionProps {
    readonly slot: DataSlot<FlowView>
    readonly labels: { readonly title: string; readonly stepsTitle: string; readonly slot: SlotLabels }
    readonly emptyText: string
    readonly on: Pick<LeadPanesOn, "flowRetry">
}

const PLACEHOLDER: FlowView = { fact: "", steps: [], sections: [] }

/** One entry of a kind: what it is, when, how it stands, and the lines that qualify it. */
/** One entry to draw. */
interface EntryTextProps {
    readonly entry: FlowEntryView
}

const EntryText = (props: EntryTextProps) => (
    <Stack gap="identity">
        <Cluster gap="inline">
            <Text as="span" size="sm" isStrong>
                {props.entry.head}
            </Text>
            {props.entry.badge === null ? null : <Badge tone={props.entry.badge.tone}>{props.entry.badge.label}</Badge>}
        </Cluster>
        {[props.entry.when?.label, props.entry.reason]
            .filter((line): line is string => line !== null && line !== undefined && line !== "")
            .map((line) => (
                <Text key={line} as="p" size="xs" tone="muted">
                    {line}
                </Text>
            ))}
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
)

/** The aside's orders and payments: what the AI worked on, then the orders, invoices, payments and decisions of this customer, each kind one row, "none yet" when empty. */
export const LeadFlowSection = (props: LeadFlowSectionProps) => (
    <SlotView
        slot={props.slot}
        placeholder={PLACEHOLDER}
        labels={props.labels.slot}
        onRetry={props.on.flowRetry}
        render={(view, isLoading) => {
            const rows = [{ id: "steps", title: props.labels.stepsTitle, entries: view.steps }, ...view.sections]
            return (
                <Section id="flow" title={props.labels.title} headingLevel={2} isLoading={isLoading}>
                    <DescriptionList
                        isLoading={isLoading}
                        items={(isLoading ? ["orders", "invoices", "payments"] : rows.map((row) => row.id)).map(
                            (id) => {
                                const row = rows.find((candidate) => candidate.id === id)
                                return {
                                    id,
                                    term: row?.title ?? "",
                                    description:
                                        row === undefined || row.entries.length === 0 ? (
                                            props.emptyText
                                        ) : (
                                            <Stack gap="row">
                                                {row.entries.map((entry) => (
                                                    <EntryText key={entry.id} entry={entry} />
                                                ))}
                                            </Stack>
                                        ),
                                }
                            },
                        )}
                    />
                </Section>
            )
        }}
    />
)

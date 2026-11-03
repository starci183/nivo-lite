import { Button, Cluster, EmptyNotice, Section, Stack, Text, Link } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { ListRowData } from "@starci/grammar/common"

/** One received input with every word already in the reader's language. */
export interface InboxFeedRow {
    readonly id: string
    readonly source: string
    readonly kind: string
    readonly ago: string
    readonly status: { readonly label: string; readonly tone: "neutral" | "success" | "warning" | "danger" }
    readonly body: string
    /** Sender, contact, amount, reference and event lines. */
    readonly meta: ReadonlyArray<{ readonly key: string; readonly text: string; readonly strong: boolean }>
    readonly duplicates: string | null
    readonly lead: { readonly href: string; readonly label: string } | null
    readonly office: { readonly href: string; readonly label: string } | null
}

/** Props for {@link InboxFeedBase}. */
export interface InboxFeedBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly refreshLabel: string
        readonly slot: DataSlot<ReadonlyArray<InboxFeedRow>>
        readonly labels: SlotLabels
    }
    readonly on: { readonly refresh: () => void }
}

/** Three resting rows: the skeleton keeps the height of the ready feed. */
const PLACEHOLDER: ReadonlyArray<InboxFeedRow> = ["a", "b", "c"].map((id) => ({
    id,
    source: "",
    kind: "",
    ago: "",
    status: { label: "", tone: "neutral" },
    body: "",
    meta: [],
    duplicates: null,
    lead: null,
    office: null,
}))

/** Feed of received inputs, newest first, with the list owning its status and row anatomy. */
export const InboxFeedBase = (props: InboxFeedBaseProps) => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={PLACEHOLDER}
            labels={view.labels}
            onRetry={props.on.refresh}
            render={(rows, isLoading) => {
                const items: ListRowData[] = rows.map((row) => ({
                    id: row.id,
                    title: row.source,
                    description: [row.kind, row.ago].join(" · "),
                    badges: [{ label: row.status.label, tone: row.status.tone }],
                    detail: (
                        <Stack gap="row">
                            {row.body === "" ? null : <Text overflow="clamp-2">{row.body}</Text>}
                            <Cluster gap="inline">
                                {row.meta.map((line) => (
                                    <Text
                                        key={line.key}
                                        size="sm"
                                        {...(line.strong ? { isStrong: true } : { tone: "muted" as const })}
                                    >
                                        {line.text}
                                    </Text>
                                ))}
                            </Cluster>
                            {row.duplicates === null && row.lead === null && row.office === null ? null : (
                                <Cluster gap="inline" justify="between">
                                    {row.duplicates === null ? null : (
                                        <Text size="sm" tone="muted">
                                            {row.duplicates}
                                        </Text>
                                    )}
                                    {row.lead === null ? null : <Link href={row.lead.href}>{row.lead.label}</Link>}
                                    {row.office === null ? null : (
                                        <Link href={row.office.href}>{row.office.label}</Link>
                                    )}
                                </Cluster>
                            )}
                        </Stack>
                    ),
                }))
                return (
                    <Section
                        kind="list"
                        title={view.title}
                        description={view.description}
                        isLoading={isLoading}
                        action={
                            <Button intent="neutral" onPress={props.on.refresh}>
                                {view.refreshLabel}
                            </Button>
                        }
                        items={items}
                        empty={<EmptyNotice message={view.labels.empty} />}
                    />
                )
            }}
        />
    )
}

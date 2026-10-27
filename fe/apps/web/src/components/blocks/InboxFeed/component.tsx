import {
    Badge,
    Button,
    ListRow,
    Region,
    SectionHeader,
    SurfaceListCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FEED_BODY_CLASS, FEED_FOOT_CLASS, FEED_META_CLASS, FEED_SECTION_CLASS } from "./classNames"

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
        readonly ariaLabel: string
        readonly title: string
        readonly description: string
        readonly refreshLabel: string
        readonly slot: DataSlot<ReadonlyArray<InboxFeedRow>>
        readonly labels: SlotLabels
    }
    readonly on: { readonly refresh: () => void }
}

const PLACEHOLDER: ReadonlyArray<InboxFeedRow> = []

/** Feed of received inputs, newest first, each with where it stands. */
export const InboxFeedBase = (props: InboxFeedBaseProps) => {
    const view = props.props
    return (
        <Region className={FEED_SECTION_CLASS} label={view.ariaLabel}>
            <SectionHeader
                level={2}
                title={view.title}
                description={view.description}
                action={
                    <Button intent="neutral" onPress={props.on.refresh}>
                        {view.refreshLabel}
                    </Button>
                }
            />
            <SlotView slot={view.slot} placeholder={PLACEHOLDER} labels={view.labels} onRetry={props.on.refresh}>
                {(rows, isSkeleton) => (
                    <SurfaceListCard ariaLabel={view.title} isLoading={isSkeleton}>
                        {rows.map((row) => (
                            <ListRow
                                key={row.id}
                                title={row.source}
                                description={`${row.kind} · ${row.ago}`}
                                badges={<Badge tone={row.status.tone}>{row.status.label}</Badge>}
                            >
                                <div className={FEED_BODY_CLASS}>
                                    {row.body === "" ? null : <Text overflow="clamp-2">{row.body}</Text>}
                                    <div className={FEED_META_CLASS}>
                                        {row.meta.map((line) => (
                                            <Text
                                                key={line.key}
                                                size="sm"
                                                {...(line.strong ? {} : { tone: "muted" as const })}
                                                {...(line.strong ? { weight: "medium" as const } : {})}
                                            >
                                                {line.text}
                                            </Text>
                                        ))}
                                    </div>
                                    {row.duplicates === null && row.lead === null && row.office === null ? null : (
                                        <div className={FEED_FOOT_CLASS}>
                                            {row.duplicates === null ? null : (
                                                <Text size="sm" tone="muted">
                                                    {row.duplicates}
                                                </Text>
                                            )}
                                            {row.lead === null ? null : (
                                                <TextAction href={row.lead.href}>{row.lead.label}</TextAction>
                                            )}
                                            {row.office === null ? null : (
                                                <TextAction href={row.office.href}>{row.office.label}</TextAction>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </ListRow>
                        ))}
                    </SurfaceListCard>
                )}
            </SlotView>
        </Region>
    )
}

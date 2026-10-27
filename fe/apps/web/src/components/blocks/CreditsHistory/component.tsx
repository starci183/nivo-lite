import { Badge, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { CreditsHistoryRow, DataSlot, SlotLabels } from "@/modules/types"

/** The payment history: its title, the placeholder word, the rows slot and the words of its states. */
interface CreditsHistoryBaseProps {
    readonly props: {
        readonly title: string
        readonly loading: string
        readonly slot: DataSlot<ReadonlyArray<CreditsHistoryRow>>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws localized history rows, including the shared slot loading and error recipe. */
export const CreditsHistoryBase = (props: CreditsHistoryBaseProps) => {
    const placeholder: ReadonlyArray<CreditsHistoryRow> = Array.from({ length: 3 }, (_, index) => ({
        id: String(index),
        title: props.props.loading,
        description: props.props.loading,
        status: "",
        tone: "neutral",
    }))
    return (
        <div id="payments">
            <SurfaceListCard label={props.props.title} headingLevel={2}>
                <SlotView
                    slot={props.props.slot}
                    placeholder={placeholder}
                    labels={props.props.labels}
                    onRetry={props.on.retry}
                >
                    {(rows, isSkeleton) => (
                        <>
                            {rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    title={<Text isSkeleton={isSkeleton}>{row.title}</Text>}
                                    description={
                                        <Text size="sm" isSkeleton={isSkeleton}>
                                            {row.description}
                                        </Text>
                                    }
                                    badges={
                                        row.status ? (
                                            <Badge tone={row.tone} isSkeleton={isSkeleton}>
                                                {row.status}
                                            </Badge>
                                        ) : undefined
                                    }
                                />
                            ))}
                        </>
                    )}
                </SlotView>
            </SurfaceListCard>
        </div>
    )
}

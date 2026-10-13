import { Badge, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { useCreditsHistory, CreditsHistoryRow } from "@/hooks/credits"

interface CreditsHistoryBaseProps {
    readonly props: ReturnType<typeof useCreditsHistory>["props"]
    readonly on: { readonly retry: () => void }
}

/** Draws localized history rows, including the shared slot loading and error recipe. */
export const CreditsHistoryBase = (props: CreditsHistoryBaseProps) => {
    const placeholder: CreditsHistoryRow[] = Array.from({ length: 3 }, (_, index) => ({
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
                                    badges={row.status ? <Badge tone={row.tone}>{row.status}</Badge> : undefined}
                                />
                            ))}
                        </>
                    )}
                </SlotView>
            </SurfaceListCard>
        </div>
    )
}

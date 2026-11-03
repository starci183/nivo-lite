import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@nivo/agent-sdk/workbench"
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
            <SlotView
                slot={props.props.slot}
                placeholder={placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <SurfaceCard
                        kind="list"
                        label={props.props.title}
                        headingLevel={2}
                        isLoading={isLoading}
                        items={rows.map((row) => ({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            ...(row.status === "" ? {} : { badges: [{ label: row.status, tone: row.tone }] as const }),
                        }))}
                        empty={<EmptyNotice message={props.props.labels.empty} />}
                    />
                )}
            />
        </div>
    )
}

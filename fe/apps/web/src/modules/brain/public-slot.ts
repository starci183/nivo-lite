import type { DataSlot, PublicCardState, SlotLabels } from "@/modules/types"

/** What turns a read into the state of a card. */
interface SlotCardInput<Row> {
    readonly slot: DataSlot<ReadonlyArray<Row>>
    /** Rows of the shape of ready ones, drawn as the skeleton while the first read waits. */
    readonly placeholder: ReadonlyArray<Row>
    readonly labels: SlotLabels
    /** The line under the failure: what to do about it. */
    readonly errorDescription: string
    readonly onRetry: () => void
}

/**
 * A read as the state of a card that keeps its own head and zones in every state (so a filter that matched nothing can still be
 * cleared): its rows or the skeleton rows, and the failure with its retry. A read that settled with nothing, or that the viewer may
 * not see, has no rows and no failure: the card's own empty notice answers.
 */
export const slotCardOf = <Row>(input: SlotCardInput<Row>): PublicCardState<Row> => {
    const { slot, labels } = input
    if ("isLoading" in slot) {
        return { rows: input.placeholder, isLoading: true, error: undefined, count: undefined, emptyTitle: labels.empty }
    }
    if ("isError" in slot) {
        return {
            rows: [],
            isLoading: false,
            error: {
                message: labels.error,
                description: input.errorDescription,
                actionLabel: labels.retry,
                onAction: input.onRetry,
            },
            count: undefined,
            emptyTitle: labels.empty,
        }
    }
    const rows = "items" in slot ? slot.items : []
    return { rows, isLoading: false, error: undefined, count: rows.length, emptyTitle: labels.empty }
}

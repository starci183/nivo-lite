import type { ReactNode } from "react"
import { EmptyNotice } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for SlotView. */
type SlotViewProps<T> = {
    readonly slot: DataSlot<T>
    /** Fake data of the same shape: the skeleton reuses the ready tree. */
    readonly placeholder: T
    readonly labels: SlotLabels
    /** A secondary slot disappears on 403; a primary slot says so in place. */
    readonly forbidden?: "hide" | "notice"
    readonly onRetry?: () => void
    readonly children: (data: T, isSkeleton: boolean) => ReactNode
}

/**
 * Composite: the ONE recipe for a slot's data status. No block writes its own
 * loading / forbidden / error / empty branch; each one renders through here.
 */
export const SlotView = <T,>(props: SlotViewProps<T>) => {
    const { slot, labels } = props
    if (slot.isLoading) return <>{props.children(props.placeholder, true)}</>
    if (slot.isForbidden) return props.forbidden === "hide" ? null : <EmptyNotice message={labels.forbidden} />
    if (slot.isError) {
        return (
            <EmptyNotice
                message={labels.error}
                actionLabel={labels.retry}
                actionVariant="secondary"
                {...(props.onRetry === undefined ? {} : { onAction: props.onRetry })}
            />
        )
    }
    const items = slot.items
    if (items === undefined || (Array.isArray(items) && items.length === 0)) {
        return <EmptyNotice message={labels.empty} />
    }
    return <>{props.children(items, false)}</>
}

/** Props for SlotBoundView. */
type SlotBoundViewProps<T> = {
    /** What a block carries together: the slot, its same-shape placeholder and the words of its states. */
    readonly from: {
        readonly slot: DataSlot<T>
        readonly placeholder: T
        readonly slotLabels: SlotLabels
    }
    readonly onRetry?: () => void
    readonly children: (data: T, isSkeleton: boolean) => ReactNode
}

/** SlotView for a block whose props carry `slot`, `placeholder` and `slotLabels` together. */
export const SlotBoundView = <T,>(props: SlotBoundViewProps<T>) => (
    <SlotView
        slot={props.from.slot}
        placeholder={props.from.placeholder}
        labels={props.from.slotLabels}
        {...(props.onRetry === undefined ? {} : { onRetry: props.onRetry })}
    >
        {props.children}
    </SlotView>
)

import type { ReactNode } from "react"
import { EmptyNotice } from "@starci/grammar/common"

/** The data status of one API. Each field is an atom so a slot can cross into a pure Base. */
export type Slot<T> = {
    readonly isLoading?: boolean
    readonly isForbidden?: boolean
    readonly isError?: boolean
    readonly items?: T
}

/** The part of a query result from which a slot is derived. */
export type SlotSource<T> = {
    readonly data?: T
    readonly isLoading: boolean
    readonly error?: { readonly status?: number }
}

/** Folds a query result into a slot; 403 is its own status, never a generic error. */
export const toSlot = <T,>(source: SlotSource<T>): Slot<T> => ({
    isLoading: source.isLoading,
    isForbidden: source.error?.status === 403,
    isError: source.error !== undefined && source.error.status !== 403,
    items: source.data,
})

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    readonly empty: string
    readonly forbidden: string
    readonly error: string
    readonly retry: string
}

/** Props for SlotView. */
export type SlotViewProps<T> = {
    readonly slot: Slot<T>
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
        return <EmptyNotice message={labels.error} actionLabel={labels.retry} actionVariant="secondary" onAction={props.onRetry} />
    }
    const isEmpty = slot.items === undefined || (Array.isArray(slot.items) && slot.items.length === 0)
    if (isEmpty) return <EmptyNotice message={labels.empty} />
    return <>{props.children(slot.items as T, false)}</>
}

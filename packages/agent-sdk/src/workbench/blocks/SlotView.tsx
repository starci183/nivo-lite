import type { ReactNode } from "react"
import { EmptyNotice } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "../slot/slot.types"

/** Props for SlotView. */
export type SlotViewProps<T> = {
    readonly slot: DataSlot<T>
    /** Fake data of the same shape: the skeleton reuses the ready tree. */
    readonly placeholder: T
    readonly labels: SlotLabels
    /** A secondary slot disappears on 403; a primary slot says so in place. */
    readonly forbidden?: "hide" | "notice"
    /** Drawn under the forbidden notice of a primary slot: the way out (a link back). */
    readonly forbiddenAction?: ReactNode
    /** Resolved supporting copy for the primary forbidden notice. */
    readonly forbiddenDescription?: string
    /** Resolved supporting copy for the existing error notice. */
    readonly errorDescription?: string
    /** A slot with nothing in it: its notice (default), or nothing at all for a box that collapses when empty. */
    readonly empty?: "notice" | "collapse"
    /** Resolved supporting copy for the empty notice. */
    readonly emptyDescription?: string
    readonly onRetry?: () => void
    /** The ready tree, drawn once with the placeholder while the first read loads (`render(placeholder, true)`). */
    readonly render: (data: T, isLoading: boolean) => ReactNode
}

/** The forbidden recipe either collapses the secondary region or keeps its exit action visible. */
const forbiddenNotice = (
    mode: "hide" | "notice" | undefined,
    message: string,
    description: string | undefined,
    action: ReactNode,
) => {
    if (mode === "hide") return null
    return (
        <>
            <EmptyNotice message={message} {...(description === undefined ? {} : { description })} />
            {action}
        </>
    )
}

/** The failed read keeps its own retry and supporting copy. */
const errorNotice = (
    message: string,
    description: string | undefined,
    retryLabel: string,
    retry: (() => void) | undefined,
) => (
    <EmptyNotice
        message={message}
        {...(description === undefined ? {} : { description })}
        actionLabel={retryLabel}
        {...(retry === undefined ? {} : { onAction: retry })}
    />
)

/**
 * Composite: the ONE recipe for a slot's data status. No block writes its own
 * loading / forbidden / error / empty branch; each one renders through here.
 */
export const SlotView = <T,>(props: SlotViewProps<T>): ReactNode => {
    const { slot, labels } = props
    if ("isLoading" in slot) return <>{props.render(props.placeholder, true)}</>
    if ("isForbidden" in slot)
        return forbiddenNotice(props.forbidden, labels.forbidden, props.forbiddenDescription, props.forbiddenAction)
    if ("isError" in slot) return errorNotice(labels.error, props.errorDescription, labels.retry, props.onRetry)
    if ("isEmpty" in slot) {
        return props.empty === "collapse" ? null : (
            <EmptyNotice
                message={labels.empty}
                {...(props.emptyDescription === undefined ? {} : { description: props.emptyDescription })}
            />
        )
    }
    return <>{props.render(slot.items, false)}</>
}

import type { ReactElement, ReactNode } from "react"
import { Alert, EmptyNotice } from "@starci/grammar/common"
import type { IconSource } from "@starci/grammar/common"
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
    /**
     * Where the notices of a slot that is not ready sit: the one surface the block draws its content on, so the error, the forbidden
     * and the empty notice are inside it like the ready content, and only the block's label stays outside. Absent: the notice stands bare.
     */
    readonly frame?: (notice: ReactNode) => ReactNode
    /** A slot with nothing in it: its notice (default), or nothing at all for a box that collapses when empty. */
    readonly empty?: "notice" | "collapse"
    /** Resolved supporting copy for the empty notice. */
    readonly emptyDescription?: string
    /** The glyph above the empty notice. */
    readonly emptyIconSource?: IconSource
    /** The one action of the empty notice: it invites the next step (add the first one, connect, clear the filter). */
    readonly emptyAction?: { readonly label: string; readonly onAction: () => void }
    /**
     * How a failed read draws. `auto` (default): the Grammar failure view, a soft danger band inside a pane and a centred notice
     * elsewhere. `band`: the same soft danger band with its retry in any region (a page body, a section, a card).
     */
    readonly errorLayout?: "auto" | "band"
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
    if (mode === "hide") return <></>
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
    layout: "auto" | "band" | undefined,
) =>
    layout === "band" ? (
        <Alert
            tone="negative"
            title={message}
            {...(description === undefined ? {} : { description })}
            {...(retry === undefined ? {} : { action: { label: retryLabel, onAction: retry } })}
        />
    ) : (
        <EmptyNotice
            isError
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
export const SlotView = <T,>(props: SlotViewProps<T>): ReactElement => {
    const { slot, labels } = props
    const framed = (notice: ReactNode): ReactElement => <>{props.frame === undefined ? notice : props.frame(notice)}</>
    if ("isLoading" in slot) return <>{props.render(props.placeholder, true)}</>
    if ("isForbidden" in slot)
        return framed(
            forbiddenNotice(props.forbidden, labels.forbidden, props.forbiddenDescription, props.forbiddenAction),
        )
    if ("isError" in slot)
        return framed(errorNotice(labels.error, props.errorDescription, labels.retry, props.onRetry, props.errorLayout))
    if ("isEmpty" in slot) {
        return props.empty === "collapse" ? (
            <></>
        ) : (
            framed(
                <EmptyNotice
                    message={labels.empty}
                    {...(props.emptyDescription === undefined ? {} : { description: props.emptyDescription })}
                    {...(props.emptyIconSource === undefined ? {} : { iconSource: props.emptyIconSource })}
                    {...(props.emptyAction === undefined
                        ? {}
                        : { actionLabel: props.emptyAction.label, onAction: props.emptyAction.onAction })}
                />,
            )
        )
    }
    return <>{props.render(slot.items, false)}</>
}

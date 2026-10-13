import type { ReactNode } from "react"
import { Alert, SurfaceListCard } from "@starci/grammar/common"

/** The words of a region that failed in place. */
export interface RegionFailure {
    readonly title: string
    readonly description: string
    readonly retryLabel: string
}

/** What a region needs besides its own view. */
interface RegionStateProps<T> {
    readonly label: string
    /** The data is coming: the card draws as a skeleton. */
    readonly isLoading: boolean
    /** The region could not be read. */
    readonly isFailed: boolean
    readonly view: T
    readonly failure: RegionFailure
    readonly onRetry: () => void
    readonly children: (view: T) => ReactNode
}

/** The one recipe of a region's status: skeleton while it loads, one negative Alert with a retry when it failed, else its card. */
export const RegionState = <T,>(props: RegionStateProps<T>) => {
    if (props.isLoading) return <SurfaceListCard label={props.label} isLoading />
    if (props.isFailed) {
        return (
            <Alert
                tone="negative"
                title={props.failure.title}
                description={props.failure.description}
                action={{ label: props.failure.retryLabel, onAction: props.onRetry }}
            />
        )
    }
    return <>{props.children(props.view)}</>
}

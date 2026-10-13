import { Alert, SurfaceListCard } from "@starci/grammar/common"
import type { RegionFailure } from "@/components/branches/RegionState"

/** Props for {@link PanelPending}. */
export interface PanelPendingProps {
    /** The name of the panel being read, for assistive technology. */
    readonly label: string
    /** The read failed: the words of the notice; null while it is still coming. */
    readonly failure: RegionFailure | null
    readonly onRetry?: () => void
}

/** A workbench panel whose data is not there: three skeleton rows while it is read, or one negative notice with a retry when it failed. */
export const PanelPending = (props: PanelPendingProps) => {
    if (props.failure === null) return <SurfaceListCard ariaLabel={props.label} isLoading />
    return (
        <Alert
            tone="negative"
            title={props.failure.title}
            description={props.failure.description}
            action={
                props.onRetry === undefined ? undefined : { label: props.failure.retryLabel, onAction: props.onRetry }
            }
        />
    )
}

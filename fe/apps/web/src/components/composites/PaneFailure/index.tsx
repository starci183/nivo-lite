import { EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** What the failed page says: what happened, the supporting line, and the way out. */
interface PaneFailureProps {
    /** Names the grid for assistive technology. */
    readonly label: string
    readonly title: string
    readonly description: string
    readonly retryLabel: string
    readonly onRetry: () => void
}

/**
 * A routed page whose data failed, drawn inside the pane of a frame that keeps its own band and list: one danger notice in the pane,
 * with the retry in place.
 */
export const PaneFailure = (props: PaneFailureProps) => (
    <PaneGrid label={props.label} areas={["main"]}>
        <Pane area="main" label={props.label}>
            <PaneSection align="center" grow>
                <EmptyNotice
                    isError
                    message={props.title}
                    description={props.description}
                    actionLabel={props.retryLabel}
                    onAction={props.onRetry}
                />
            </PaneSection>
        </Pane>
    </PaneGrid>
)

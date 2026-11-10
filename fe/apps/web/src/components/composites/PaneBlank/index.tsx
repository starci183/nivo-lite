import type { ReactNode } from "react"
import { EmptyNotice, PaneSection } from "@starci/grammar/common"
import type { IconSource } from "@starci/grammar/common"

/** What the main pane says while nothing is open. */
interface PaneBlankProps {
    readonly message: string
    readonly description?: string
    readonly iconSource?: IconSource
    /** The one action that invites the next step (a way back, for example). */
    readonly actionLabel?: string
    readonly onAction?: () => void
    /** `frameless` draws the notice with no card of its own (an inbox with nothing open); the default is the card. */
    readonly frame?: "card" | "frameless"
    /** A modal the pane hosts (a drawer, a dialog): portalled, so it takes no room. */
    readonly overlay?: ReactNode
}

/** The main pane's notice while nothing is open: it asks for a choice, centred on the canvas. */
export const PaneBlank = (props: PaneBlankProps) => (
    <PaneSection align="center" grow>
        <EmptyNotice
            message={props.message}
            {...(props.frame === undefined ? {} : { frame: props.frame })}
            {...(props.description === undefined ? {} : { description: props.description })}
            {...(props.iconSource === undefined ? {} : { iconSource: props.iconSource })}
            {...(props.actionLabel === undefined || props.onAction === undefined
                ? {}
                : { actionLabel: props.actionLabel, onAction: props.onAction })}
        />
        {props.overlay}
    </PaneSection>
)

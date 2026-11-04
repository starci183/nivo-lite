import { EmptyNotice, PaneSection } from "@starci/grammar/common"
import type { IconSource } from "@starci/grammar/common"

/** What the main pane says while nothing is open. */
interface PaneBlankProps {
    readonly message: string
    readonly description?: string
    readonly iconSource?: IconSource
}

/** The main pane's notice while nothing is open: it asks for a choice, centred on the canvas. */
export const PaneBlank = (props: PaneBlankProps) => (
    <PaneSection align="center" grow>
        <EmptyNotice
            message={props.message}
            {...(props.description === undefined ? {} : { description: props.description })}
            {...(props.iconSource === undefined ? {} : { iconSource: props.iconSource })}
        />
    </PaneSection>
)

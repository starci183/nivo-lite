import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"
import { AutomationsPageLayout } from "@/components/composites/AutomationsPageLayout"

/** Copy and focus of the automations page. */
export interface AutomationsPageBaseProps {
    readonly props: {
        /** The card to open when the board appears; none stays closed. */
        readonly focus?: string | undefined
        readonly advancedLabel: string
        readonly advancedHref: string
    }
}

/** Draws the automations page: the heading, and the board with the link to Advanced as its body. */
export const AutomationsPageBase = (props: AutomationsPageBaseProps) => (
    <AutomationsHeading>
        <AutomationsPageLayout
            board={
                <AutomationsBoard
                    layout="page"
                    {...(props.props.focus === undefined ? {} : { focus: props.props.focus })}
                />
            }
            advancedLabel={props.props.advancedLabel}
            advancedHref={props.props.advancedHref}
        />
    </AutomationsHeading>
)

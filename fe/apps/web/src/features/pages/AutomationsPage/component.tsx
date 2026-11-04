import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"

/** The card to open when the board appears; none stays closed. */
export interface AutomationsPageBaseProps {
    readonly props: {
        readonly focus?: string | undefined
    }
}

/** Draws the automations page: the heading with its link to Advanced, and the board as its body. */
export const AutomationsPageBase = (props: AutomationsPageBaseProps) => (
    <AutomationsHeading>
        <AutomationsBoard layout="page" {...(props.props.focus === undefined ? {} : { focus: props.props.focus })} />
    </AutomationsHeading>
)

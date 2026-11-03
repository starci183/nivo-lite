import { Disclosure, Fieldset, PaneSection } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One numbered setup step of a connection page: its words, whether it is open, its commands, and its body as children. */
interface ConnectionStepBandProps {
    /** The step's place in the order, from 1. */
    readonly ordinal: number
    readonly title: string
    /** What the step stands at, beside the title: done with its fact, or what is left. */
    readonly summary: string
    /** The standing guidance under the title, inside the open step. */
    readonly hint: string
    readonly isOpen: boolean
    readonly onToggle: (isOpen: boolean) => void
    /** The step's commands, after its fields. */
    readonly actions?: ReactNode
    readonly children: ReactNode
}

/** One setup step as a band of its pane: a disclosure (STATE-7) whose head carries the ordinal, the title and the summary, and whose body is a field group. */
export const ConnectionStepBand = (props: ConnectionStepBandProps) => (
    <PaneSection>
        <Disclosure
            headingLevel={2}
            title={`${props.ordinal}. ${props.title}`}
            summary={props.summary}
            isExpanded={props.isOpen}
            onExpandedChange={props.onToggle}
            body={
                <Fieldset legend={props.title} isLegendHidden description={props.hint} actions={props.actions}>
                    {props.children}
                </Fieldset>
            }
        />
    </PaneSection>
)

import { Disclosure, Fieldset, LeadingNumber, PaneSection } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One numbered setup step of a connection page: its words, its body and its commands. */
interface ConnectionStep {
    readonly id: string
    readonly title: string
    /** What the step stands at, beside the title: done with its fact, or what is left. */
    readonly summary: string
    /** The standing guidance under the title, inside the open step. */
    readonly hint: string
    readonly isOpen: boolean
    readonly body: ReactNode
    /** The step's commands, after its fields. */
    readonly actions?: ReactNode
}

/** Props for {@link ConnectionSteps}. */
type ConnectionStepsProps = {
    readonly steps: ReadonlyArray<ConnectionStep>
    readonly onToggle: (id: string, isOpen: boolean) => void
}

/**
 * The setup of a connection as numbered steps, each one band of its pane: a disclosure (STATE-7, one controlled value per step) whose
 * head carries the ordinal, the title and the summary, and whose body is a field group with the guidance, the fields and the commands.
 */
export const ConnectionSteps = (props: ConnectionStepsProps) =>
    props.steps.map((step, index) => (
        <PaneSection key={step.id}>
            <Disclosure
                headingLevel={2}
                title={
                    <>
                        <LeadingNumber position={index + 1} /> {step.title}
                    </>
                }
                summary={step.summary}
                isExpanded={step.isOpen}
                onExpandedChange={(isOpen) => props.onToggle(step.id, isOpen)}
            >
                <Fieldset legend={step.title} isLegendHidden description={step.hint} actions={step.actions}>
                    {step.body}
                </Fieldset>
            </Disclosure>
        </PaneSection>
    ))

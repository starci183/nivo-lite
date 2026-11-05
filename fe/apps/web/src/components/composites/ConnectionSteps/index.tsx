import { DisclosureList, Fieldset, PaneSection, Stepper } from "@starci/grammar/common"
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
    /** The step is finished: its mark is a check; else the open step is the current one and the others are still to do. */
    readonly isDone: boolean
    /** The step stands on a failure the page knows: its mark is the warning triangle. */
    readonly isProblem?: boolean
    readonly body: ReactNode
    /** The step's commands, after its fields. */
    readonly actions?: ReactNode
}

/** Props for {@link ConnectionSteps}. */
type ConnectionStepsProps = {
    /** Names the progress landmark of the stepper above the steps. */
    readonly label: string
    readonly steps: ReadonlyArray<ConnectionStep>
    readonly onToggle: (id: string, isOpen: boolean) => void
}

/** The mark of a step: done, the one being worked on, or still to do. */
const stateOf = (step: ConnectionStep): "done" | "current" | "problem" | "todo" => {
    if (step.isProblem === true) return "problem"
    if (step.isDone) return "done"
    return step.isOpen ? "current" : "todo"
}

/**
 * The setup of a connection as numbered steps in one joined list under a dense stepper that reads where the owner stands: each step
 * is a disclosure (STATE-7, one controlled value per step) whose row carries its mark (a check, the current number, a grey number),
 * the title and the summary, and whose body is a field group with the guidance, the fields and the commands.
 */
export const ConnectionSteps = (props: ConnectionStepsProps) => (
    <>
        <PaneSection>
            <Stepper
                label={props.label}
                size="dense"
                steps={props.steps.map((step) => ({ id: step.id, label: step.title }))}
                currentStepId={(props.steps.find((step) => step.isOpen) ?? props.steps[0])?.id ?? ""}
            />
        </PaneSection>
        <PaneSection>
            <DisclosureList
                label={props.label}
                items={props.steps.map((step, index) => ({
                    id: step.id,
                    headingLevel: 2,
                    title: step.title,
                    summary: step.summary,
                    leading: { state: stateOf(step), position: index + 1 },
                    isExpanded: step.isOpen,
                    onExpandedChange: (isOpen: boolean) => props.onToggle(step.id, isOpen),
                    body: (
                        <Fieldset legend={step.title} isLegendHidden description={step.hint} actions={step.actions}>
                            {step.body}
                        </Fieldset>
                    ),
                }))}
            />
        </PaneSection>
    </>
)

/** The steps of a connection page, each with its body and the commands that end it, picked by step id. */
export const stepsWithBodies = <Step extends { readonly id: string }>(
    steps: ReadonlyArray<Step>,
    bodies: Readonly<Record<string, ReactNode>>,
    actions: Readonly<Record<string, ReactNode>>,
): ReadonlyArray<Step & { readonly body: ReactNode; readonly actions: ReactNode }> =>
    steps.map((step) => ({ ...step, body: bodies[step.id] ?? null, actions: actions[step.id] }))

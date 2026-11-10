import type { ReactNode } from "react"
import { Stepper } from "@starci/grammar/common"
import { STEP_BAR_CLASS_NAME, STEP_CLASS_NAME, STEP_FORM_CLASS_NAME, STEP_TRACK_CLASS_NAME } from "./classNames"

/** What one first-run step draws: the steps and where it stands, then the step's own body. */
interface FirstRunStepProps {
    /** The accessible name of the first-run steps. */
    readonly stepsLabel: string
    /** The labels of the steps, in order. */
    readonly steps: ReadonlyArray<string>
    /** One short line under each step label, in the order of `steps`. */
    readonly descriptions: ReadonlyArray<string>
    /** The step this screen is (`s0` the first). */
    readonly currentStepId: string
    /** `form` (default): the step's card centred at the form width. `wide`: a full-width body, for a step that compares options side by side. */
    readonly layout?: "form" | "wide"
    readonly children: ReactNode
}

/** The position a step id names (`s2` is 2). */
const stepIndexOf = (stepId: string): number => Number(stepId.slice(1))

/**
 * One first-run screen. Every step puts its steps in the same place, across the top: the segmented bar on a narrow screen,
 * the horizontal track with each step's line from the large breakpoint, done steps checked. The step's body sits under it.
 */
export const FirstRunStep = (props: FirstRunStepProps) => {
    const current = stepIndexOf(props.currentStepId)
    const steps = props.steps.map((label, index) => {
        const description = props.descriptions[index]
        return {
            id: `s${index}`,
            label,
            ...(description === undefined ? {} : { description }),
            ...(index < current ? { state: "complete" as const } : {}),
        }
    })
    return (
        <div className={STEP_CLASS_NAME}>
            <div className={STEP_BAR_CLASS_NAME}>
                <Stepper kind="bar" label={props.stepsLabel} currentStepId={props.currentStepId} steps={steps} />
            </div>
            <div className={STEP_TRACK_CLASS_NAME}>
                <Stepper label={props.stepsLabel} currentStepId={props.currentStepId} completeMarker="check" steps={steps} />
            </div>
            {props.layout === "wide" ? props.children : <div className={STEP_FORM_CLASS_NAME}>{props.children}</div>}
        </div>
    )
}

import type { ReactNode } from "react"
import { Stepper } from "@starci/grammar/common"
import {
    STEP_ART_CLASS_NAME,
    STEP_BODY_CLASS_NAME,
    STEP_CARD_CLASS_NAME,
    STEP_CLASS_NAME,
    STEP_TRACK_CLASS_NAME,
} from "./classNames"

/** What one first-run step draws: the track and where it stands, the step's card and its mascot. */
interface FirstRunStepProps {
    /** The accessible name of the first-run steps. */
    readonly stepsLabel: string
    /** The labels of the steps, in order. */
    readonly steps: ReadonlyArray<string>
    /** The step this screen is (`s0` the first); the ready screen passes the one past the last, so every step reads complete. */
    readonly currentStepId: string
    /** The step's Mascot beside the card. */
    readonly artwork: ReactNode
    readonly children: ReactNode
}

/** The position a step id names (`s2` is 2); the ready screen names the one past the last, so every step reads complete. */
const stepIndexOf = (stepId: string): number => Number(stepId.slice(1))

/** The body of one first-run screen: the step track over the step's card with its small mascot beside it. */
export const FirstRunStep = (props: FirstRunStepProps) => (
    <div className={STEP_CLASS_NAME}>
        <div className={STEP_TRACK_CLASS_NAME}>
            <Stepper
                label={props.stepsLabel}
                currentStepId={props.currentStepId}
                steps={props.steps.map((label, index) => ({
                    id: `s${index}`,
                    label,
                    ...(index < stepIndexOf(props.currentStepId) ? { state: "complete" as const } : {}),
                }))}
            />
        </div>
        <div className={STEP_BODY_CLASS_NAME}>
            <div className={STEP_CARD_CLASS_NAME}>{props.children}</div>
            <div className={STEP_ART_CLASS_NAME}>{props.artwork}</div>
        </div>
    </div>
)

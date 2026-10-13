import type { ReactNode } from "react"
import { Heading, Progress, Region, Text } from "@starci/grammar/common"
import { wizardFrameClassNames as classNames } from "./classNames"

/** What the shared wizard frame draws. */
type WizardFrameProps = {
    readonly title: string
    /** "Step n of N", already in the reader's language. */
    readonly stepLabel: string
    /** Step names, in order. */
    readonly steps: ReadonlyArray<string>
    readonly index: number
    readonly children: ReactNode
    /** The step's buttons: one filled primary, the rest outline or ghost. */
    readonly footer: ReactNode
}

/**
 * The one frame every connection wizard shares, inside the Connections drawer: the step count, the step's name and a Grammar Progress
 * in step mode, one segment per step (a horizontal Stepper cannot fit five labelled steps in a 24rem drawer), then the body and buttons.
 */
export const WizardFrame = (props: WizardFrameProps) => (
    <Region label={props.title}>
        <div className={classNames.wizard}>
            <div className={classNames.header}>
                <Text size="xs" tone="muted">
                    {props.stepLabel}
                </Text>
                <Heading level={3}>{props.steps[props.index]}</Heading>
                <Progress
                    label={props.stepLabel}
                    steps={{ total: props.steps.length, completed: props.index + 1 }}
                    valueText={props.stepLabel}
                />
            </div>
            <div className={classNames.body}>{props.children}</div>
            <div className={classNames.footer}>{props.footer}</div>
        </div>
    </Region>
)

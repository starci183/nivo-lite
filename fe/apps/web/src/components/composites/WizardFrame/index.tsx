import type { ReactNode } from "react"
import { Heading, Progress, Region, Text } from "@starci/grammar/common"
import { WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
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
    /** The step's buttons: one filled primary, the rest outline or ghost. A step with a footer of its own passes `footer` instead. */
    readonly actions?: ReadonlyArray<WizardAction>
    readonly footer?: ReactNode
    /** The frame is drawn as a placeholder while the stored connection is read. */
    readonly isSkeleton?: boolean
}

/** The four fields every wizard view carries for its frame. */
interface WizardFrameHead {
    readonly title: string
    readonly stepLabel: string
    readonly steps: ReadonlyArray<string>
    readonly index: number
}

/** The frame fields of a wizard view, to spread onto the frame. */
export const frameOf = (view: WizardFrameHead): WizardFrameHead => ({
    title: view.title,
    stepLabel: view.stepLabel,
    steps: view.steps,
    index: view.index,
})

/**
 * The one frame every connection wizard shares, inside the Connections drawer: the step count, the step's name and a Grammar Progress
 * in step mode, one segment per step (a horizontal Stepper cannot fit five labelled steps in a 24rem drawer), then the body and buttons.
 */
export const WizardFrame = (props: WizardFrameProps) => (
    <Region label={props.title}>
        <div className={classNames.wizard}>
            <div className={classNames.header}>
                <Text size="xs" tone="muted" isSkeleton={props.isSkeleton === true}>
                    {props.stepLabel}
                </Text>
                <Heading level={3} isSkeleton={props.isSkeleton === true}>
                    {props.steps[props.index]}
                </Heading>
                <Progress
                    isSkeleton={props.isSkeleton === true}
                    label={props.stepLabel}
                    steps={{ total: props.steps.length, completed: props.index + 1 }}
                    valueText={props.stepLabel}
                    tone={props.index + 1 === props.steps.length ? "success" : "accent"}
                />
            </div>
            <div className={classNames.body}>{props.children}</div>
            <div className={classNames.footer}>
                {props.actions === undefined ? (
                    props.footer
                ) : (
                    <WizardFooter actions={props.actions} isSkeleton={props.isSkeleton === true} />
                )}
            </div>
        </div>
    </Region>
)

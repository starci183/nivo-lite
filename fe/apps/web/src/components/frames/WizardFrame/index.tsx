import type { ReactNode } from "react"
import { Cluster, Progress, Section, Stack } from "@starci/grammar/common"
import { WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"

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
    <Section title={props.steps[props.index] ?? props.title} description={props.stepLabel} headingLevel={3}>
        <Stack gap="section">
            <Progress
                label={props.stepLabel}
                steps={{ total: props.steps.length, completed: props.index + 1 }}
                valueText={props.stepLabel}
                tone={props.index + 1 === props.steps.length ? "success" : "accent"}
            />
            <Stack gap="row">{props.children}</Stack>
            <Cluster gap="inline">
                {props.actions === undefined ? props.footer : <WizardFooter actions={props.actions} />}
            </Cluster>
        </Stack>
    </Section>
)

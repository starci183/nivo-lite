import type { ReactNode } from "react"
import { Cluster, Section, Stack, Stepper } from "@starci/grammar/common"
import { WizardFooter, type WizardAction } from "@/components/branches/WizardFooter"
import type { WizardPhases } from "@/modules/types"

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
    /** A connection wizard: the Stepper shows the four shared phases instead of the steps. */
    readonly phases?: WizardPhases
}

/** The Stepper of the frame: the four phases of a connection wizard, or the wizard's own steps. */
const FrameStepper = (props: Pick<WizardFrameProps, "stepLabel" | "steps" | "index" | "phases">) => {
    const phases = props.phases
    if (phases === undefined) {
        return (
            <Stepper
                label={props.stepLabel}
                currentStepId={`s${props.index}`}
                completeMarker="check"
                steps={props.steps.map((label, index) => ({
                    id: `s${index}`,
                    label,
                    ...(index < props.index ? { state: "complete" as const } : {}),
                }))}
            />
        )
    }
    const current = phases.ofStep[props.index] ?? 0
    return (
        <Stepper
            label={props.stepLabel}
            currentStepId={`p${current}`}
            completeMarker="check"
            stateLabel={(state) =>
                state === "complete" || state === "current" || state === "upcoming"
                    ? phases.stateLabels[state]
                    : undefined
            }
            steps={phases.labels.map((label, index) => ({
                id: `p${index}`,
                label,
                ...(index < current ? { state: "complete" as const } : {}),
            }))}
        />
    )
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
 * The one frame every connection wizard shares, inside the wide Connections drawer: the step's name and count, the horizontal
 * Stepper across the top (done steps checked, the same track as the first-run wizard), then the body and buttons. A connection
 * wizard passes its phases, so every provider shows the same four: details, grant, check, hand to an agent.
 */
export const WizardFrame = (props: WizardFrameProps) => (
    <Section title={props.steps[props.index] ?? props.title} description={props.stepLabel} headingLevel={3}>
        <Stack gap="inline">
            <FrameStepper
                stepLabel={props.stepLabel}
                steps={props.steps}
                index={props.index}
                {...(props.phases === undefined ? {} : { phases: props.phases })}
            />
            <Stack gap="identity">{props.children}</Stack>
            <Cluster gap="identity">
                {props.actions === undefined ? props.footer : <WizardFooter actions={props.actions} />}
            </Cluster>
        </Stack>
    </Section>
)

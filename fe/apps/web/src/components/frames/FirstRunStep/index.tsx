import type { ReactNode } from "react"
import { Cluster, Stack, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import type { StepperStep } from "@starci/grammar/common"
import {
    STEP_ART_CLASS_NAME,
    STEP_BAR_CLASS_NAME,
    STEP_CARD_CLASS_NAME,
    STEP_CLASS_NAME,
    STEP_DONE_CLASS_NAME,
    STEP_RAIL_CLASS_NAME,
    STEP_TRACK_CLASS_NAME,
    STEP_WIDE_CLASS_NAME,
} from "./classNames"

/** The words of the step rail: its name, the line under it, a line per step and the closing hint. */
export interface FirstRunRail {
    readonly title: string
    readonly text: string
    /** One line under each step label, in the order of `steps`. */
    readonly descriptions: ReadonlyArray<string>
    readonly hint: string
}

/** What one first-run step draws: the rail and where it stands, the step's card and its mascot. */
interface FirstRunStepProps {
    /** The accessible name of the first-run steps. */
    readonly stepsLabel: string
    /** The labels of the steps, in order. */
    readonly steps: ReadonlyArray<string>
    /** The step this screen is (`s0` the first); the ready screen passes the one past the last, so every step reads complete. */
    readonly currentStepId: string
    readonly rail: FirstRunRail
    /** The step's Mascot: in the rail's footer while a step is open, above the card on the ready screen. */
    readonly artwork: ReactNode
    /** `rail` (default): the rail card beside a form card. `wide`: the step track across the top over a full-width body, for a step that compares options side by side. */
    readonly layout?: "rail" | "wide"
    readonly children: ReactNode
}

/** The position a step id names (`s2` is 2); the ready screen names the one past the last, so every step reads complete. */
const stepIndexOf = (stepId: string): number => Number(stepId.slice(1))

/** What the wide and rail forms read: the step props and where the step stands. */
interface FirstRunStepFormProps {
    readonly step: FirstRunStepProps
    readonly current: number
}

/** The wide form: the step bar on a narrow screen, the horizontal track from the large breakpoint, then the full-width body. */
const WideStep = (props: FirstRunStepFormProps) => {
    const step = props.step
    return (
        <div className={STEP_WIDE_CLASS_NAME}>
            <div className={STEP_BAR_CLASS_NAME}>
                <Stepper
                    kind="bar"
                    label={step.stepsLabel}
                    currentStepId={step.currentStepId}
                    steps={step.steps.map((label, index) => ({ id: `s${index}`, label }))}
                />
            </div>
            <div className={STEP_TRACK_CLASS_NAME}>
                <Stepper
                    label={step.stepsLabel}
                    currentStepId={step.currentStepId}
                    completeMarker="check"
                    steps={step.steps.map((label, index) => ({
                        id: `s${index}`,
                        label,
                        ...(index < props.current ? { state: "complete" as const } : {}),
                    }))}
                />
            </div>
            {step.children}
        </div>
    )
}

/** What the rail card reads: the step, where it stands and the steps it lists. */
interface RailCardProps extends FirstRunStepFormProps {
    readonly steps: ReadonlyArray<StepperStep>
}

/** The rail card: its name and line in the header zone, the vertical step track, the art and hint in the footer zone. */
const RailCard = (props: RailCardProps) => {
    const step = props.step
    return (
        <SurfaceCard
            ariaLabel={step.rail.title}
            headers={[
                {
                    kind: "custom",
                    children: (
                        <Stack gap="identity">
                            <Text isStrong>{step.rail.title}</Text>
                            <Text tone="muted" size="sm">
                                {step.rail.text}
                            </Text>
                        </Stack>
                    ),
                },
            ]}
            footers={[
                {
                    kind: "custom",
                    children: (
                        <Cluster gap="row" wrap={false}>
                            <div className={STEP_ART_CLASS_NAME}>{step.artwork}</div>
                            <Text tone="muted" size="sm">
                                {step.rail.hint}
                            </Text>
                        </Cluster>
                    ),
                },
            ]}
        >
            <Stepper
                label={step.stepsLabel}
                orientation="vertical"
                completeMarker="check"
                currentStepId={step.currentStepId}
                steps={props.steps}
            />
        </SurfaceCard>
    )
}

/** The rail form: the step bar on a narrow screen, the rail card beside the step's card from the large breakpoint. */
const RailStep = (props: FirstRunStepFormProps) => {
    const step = props.step
    const steps = step.steps.map((label, index) => {
        const description = step.rail.descriptions[index]
        return {
            id: `s${index}`,
            label,
            ...(description === undefined ? {} : { description }),
            ...(index < props.current ? { state: "complete" as const } : {}),
        }
    })
    return (
        <div className={STEP_CLASS_NAME}>
            <div className={STEP_BAR_CLASS_NAME}>
                <Stepper kind="bar" label={step.stepsLabel} currentStepId={step.currentStepId} steps={steps} />
            </div>
            <div className={STEP_RAIL_CLASS_NAME}>
                <RailCard step={step} current={props.current} steps={steps} />
            </div>
            <div className={STEP_CARD_CLASS_NAME}>{step.children}</div>
        </div>
    )
}

/** The body of one first-run screen: the rail beside the step's card, the wide track over a full-width body, or on the ready screen the card alone. */
export const FirstRunStep = (props: FirstRunStepProps) => {
    const current = stepIndexOf(props.currentStepId)
    if (current >= props.steps.length) {
        return (
            <div className={STEP_DONE_CLASS_NAME}>
                {props.artwork}
                <div className={STEP_CARD_CLASS_NAME}>{props.children}</div>
            </div>
        )
    }
    return props.layout === "wide" ? (
        <WideStep step={props} current={current} />
    ) : (
        <RailStep step={props} current={current} />
    )
}

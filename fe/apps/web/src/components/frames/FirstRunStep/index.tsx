import type { ReactNode } from "react"
import { Cluster, Stack, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import {
    STEP_ART_CLASS_NAME,
    STEP_BAR_CLASS_NAME,
    STEP_CARD_CLASS_NAME,
    STEP_CLASS_NAME,
    STEP_DONE_CLASS_NAME,
    STEP_RAIL_CLASS_NAME,
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
    readonly children: ReactNode
}

/** The position a step id names (`s2` is 2); the ready screen names the one past the last, so every step reads complete. */
const stepIndexOf = (stepId: string): number => Number(stepId.slice(1))

/** The body of one first-run screen: the rail with the vertical step track beside the step's card; the ready screen is the card alone. */
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
    const steps = props.steps.map((label, index) => {
        const description = props.rail.descriptions[index]
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
            <div className={STEP_RAIL_CLASS_NAME}>
                <SurfaceCard
                    ariaLabel={props.rail.title}
                    headers={[
                        {
                            kind: "custom",
                            children: (
                                <Stack gap="identity">
                                    <Text isStrong>{props.rail.title}</Text>
                                    <Text tone="muted" size="sm">
                                        {props.rail.text}
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
                                    <div className={STEP_ART_CLASS_NAME}>{props.artwork}</div>
                                    <Text tone="muted" size="sm">
                                        {props.rail.hint}
                                    </Text>
                                </Cluster>
                            ),
                        },
                    ]}
                >
                    <Stepper
                        label={props.stepsLabel}
                        orientation="vertical"
                        currentStepId={props.currentStepId}
                        steps={steps}
                    />
                </SurfaceCard>
            </div>
            <div className={STEP_CARD_CLASS_NAME}>{props.children}</div>
        </div>
    )
}

import { Button, IconButton, List, ListItem, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { Icon, nivoIconSource } from "../../leaves/Icon"
import { ALL_SET, CHECK_BODY, CHECK_LIST, STEP, STEP_NEXT } from "./classNames"

/** One onboarding step as the checklist draws it; `done` comes from real rows and events only. */
export type OnboardingChecklistStep = {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly done: boolean
    readonly href: string
    readonly cta: string
}

const PENDING_ICON = { name: "pending", usage: "leading" } as const

/** Resolved copy and state supplied by the connected checklist block. */
export interface OnboardingChecklistBaseProps {
    readonly props: {
        readonly steps: ReadonlyArray<OnboardingChecklistStep>
        readonly isOpen: boolean
        readonly listId: string
        readonly title: string
        readonly allSet: string
        readonly allSetCount: string
        readonly progressLabel: string
        readonly progressValue: string
        readonly toggleLabel: string
        readonly doneLabel: string
    }
    readonly on: { readonly toggle: () => void }
}

type StepsProps = Pick<OnboardingChecklistBaseProps, "props">

const Steps = ({ props }: StepsProps) => {
    const nextKey = props.steps.find((step) => !step.done)?.key
    const doneIcon = { name: "complete", usage: "leading", ariaLabel: props.doneLabel } as const
    return (
        <List as="ol" id={props.listId} label={props.title} className={CHECK_LIST}>
            {props.steps.map((step) => {
                const isNext = step.key === nextKey
                return (
                    <ListItem key={step.key} className={isNext ? STEP_NEXT : STEP}>
                        <Text
                            size="sm"
                            weight={step.done ? "normal" : "medium"}
                            tone={step.done ? "muted" : "default"}
                            isSuperseded={step.done}
                            startContent={<Icon props={step.done ? doneIcon : PENDING_ICON} />}
                        >
                            {step.label}
                        </Text>
                        {isNext ? (
                            <>
                                <Text size="xs">{step.hint}</Text>
                                <Button variant="secondary" size="sm" href={step.href}>
                                    {step.cta}
                                </Button>
                            </>
                        ) : null}
                    </ListItem>
                )
            })}
        </List>
    )
}

const Checklist = ({ props, on }: OnboardingChecklistBaseProps) => {
    const doneCount = props.steps.filter((step) => step.done).length
    if (props.steps.length === 0) return null
    if (doneCount === props.steps.length) {
        return (
            <div role="status">
                <SurfaceCard>
                    <div className={ALL_SET}>
                        <Text weight="medium">{props.allSet}</Text>
                        <Text size="xs">{props.allSetCount}</Text>
                    </div>
                </SurfaceCard>
            </div>
        )
    }
    return (
        <SurfaceCard
            label={props.title}
            headingLevel={2}
            labelEnd={
                <IconButton
                    variant="ghost"
                    source={nivoIconSource("disclosure", "leading")}
                    label={props.toggleLabel}
                    aria-expanded={props.isOpen}
                    aria-controls={props.listId}
                    onPress={on.toggle}
                />
            }
        >
            <div className={CHECK_BODY}>
                <Meter
                    label={props.progressLabel}
                    value={doneCount}
                    minValue={0}
                    maxValue={props.steps.length}
                    valueLabel={props.progressValue}
                    tone="informative"
                />
                {props.isOpen ? <Steps props={props} /> : null}
            </div>
        </SurfaceCard>
    )
}

/** Draws the onboarding progress card, or the single "all set" line once every step is done. */
export const OnboardingChecklistBase = (props: OnboardingChecklistBaseProps) => (
    <Checklist props={props.props} on={props.on} />
)

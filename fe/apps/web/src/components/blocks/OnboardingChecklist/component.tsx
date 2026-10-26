import { Button, IconButton, List, ListRow, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import { ALL_SET, CHECK_BODY } from "./classNames"

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

/** How a step row reads: done, the one next step, or still waiting. */
const stateOf = (isDone: boolean, isNext: boolean): "affirmative" | "informative" | "neutral" => {
    if (isDone) return "affirmative"
    return isNext ? "informative" : "neutral"
}

type StepsProps = Pick<OnboardingChecklistBaseProps, "props">

const Steps = ({ props }: StepsProps) => {
    const nextKey = props.steps.find((step) => !step.done)?.key
    const doneIcon = { name: "complete", usage: "leading", ariaLabel: props.doneLabel } as const
    return (
        <List as="ol" id={props.listId} label={props.title}>
            {props.steps.map((step) => {
                const isNext = step.key === nextKey
                return (
                    <ListRow
                        key={step.key}
                        state={stateOf(step.done, isNext)}
                        title={
                            <Text
                                size="sm"
                                weight={step.done ? "normal" : "medium"}
                                tone={step.done ? "muted" : "default"}
                                isSuperseded={step.done}
                                startContent={<Icon props={step.done ? doneIcon : PENDING_ICON} />}
                            >
                                {step.label}
                            </Text>
                        }
                        description={isNext ? step.hint : null}
                        actions={
                            isNext ? (
                                <Button intent="neutral" size="sm" href={step.href}>
                                    {step.cta}
                                </Button>
                            ) : null
                        }
                    />
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
            <SurfaceCard>
                <output className={ALL_SET}>
                    <Text as="span" weight="medium">
                        {props.allSet}
                    </Text>
                    <Text as="span" size="xs">
                        {props.allSetCount}
                    </Text>
                </output>
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard
            label={props.title}
            headingLevel={2}
            labelEnd={
                <IconButton
                    intent="neutral"
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

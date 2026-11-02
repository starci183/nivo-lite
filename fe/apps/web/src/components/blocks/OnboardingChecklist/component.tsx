import { Cluster, IconButton, Meter, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One onboarding step as the checklist draws it; `done` comes from real rows and events only. */
export type OnboardingChecklistStep = {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly done: boolean
    readonly href: string
    readonly cta: string
}

/** What the card draws while the dashboard is read: three undone steps as inert geometry. */
export const ONBOARDING_CHECKLIST_PLACEHOLDER: ReadonlyArray<OnboardingChecklistStep> = ["a", "b", "c"].map((key) => ({
    key,
    label: "-",
    hint: "-",
    done: false,
    href: "",
    cta: "-",
}))

/** Resolved copy and state supplied by the connected checklist block. */
export interface OnboardingChecklistBaseProps {
    readonly props: {
        readonly steps: ReadonlyArray<OnboardingChecklistStep>
        readonly isOpen: boolean
        readonly title: string
        readonly allSet: string
        readonly allSetCount: string
        readonly progressLabel: string
        readonly progressValue: string
        readonly toggleLabel: string
        readonly doneLabel: string
        /** The steps are placeholders: the card draws its lines as skeleton. */
        readonly isLoading: boolean
    }
    readonly on: { readonly toggle: () => void }
}

/** How a step row reads: done, the one next step, or still waiting. */
const stateOf = (isDone: boolean, isNext: boolean): "affirmative" | "informative" | "neutral" => {
    if (isDone) return "affirmative"
    return isNext ? "informative" : "neutral"
}

type StepsProps = Pick<OnboardingChecklistBaseProps, "props">

const stepsOf = ({ props }: StepsProps): ReadonlyArray<ListRowData> => {
    const nextKey = props.steps.find((step) => !step.done)?.key
    return props.steps.map((step): ListRowData => {
        const isNext = step.key === nextKey
        return {
            id: step.key,
            title: step.label,
            state: stateOf(step.done, isNext),
            ...(isNext ? { description: step.hint } : {}),
            leading: { icon: nivoIconSource(step.done ? "complete" : "pending", "leading") },
            ...(step.done ? { badges: [{ label: props.doneLabel, tone: "success" }] as const } : {}),
            ...(isNext ? { action: { label: step.cta, href: step.href } as const } : {}),
        }
    })
}

const Checklist = ({ props, on }: OnboardingChecklistBaseProps) => {
    const doneCount = props.steps.filter((step) => step.done).length
    if (props.steps.length === 0) return null
    if (doneCount === props.steps.length) {
        return (
            <SurfaceCard>
                <output>
                    <Cluster gap="row" justify="between">
                        <Text as="span" isStrong>
                            {props.allSet}
                        </Text>
                        <Text as="span" size="xs">
                            {props.allSetCount}
                        </Text>
                    </Cluster>
                </output>
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard
            {...(props.isOpen
                ? ({ kind: "list", items: stepsOf({ props }), empty: <Text>{props.allSet}</Text> } as const)
                : ({
                      kind: "body",
                      children: (
                          <Meter
                              label={props.progressLabel}
                              value={doneCount}
                              minValue={0}
                              maxValue={props.steps.length}
                              valueLabel={props.progressValue}
                              tone="informative"
                              isLoading={props.isLoading}
                          />
                      ),
                  } as const))}
            label={props.title}
            headingLevel={2}
            isLoading={props.isLoading}
            labelEnd={
                <Cluster gap="inline">
                    <Text size="xs" tone="muted" isLoading={props.isLoading}>
                        {props.progressValue}
                    </Text>
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("disclosure", "leading")}
                        label={props.toggleLabel}
                        aria-expanded={props.isOpen}
                        onPress={on.toggle}
                        isLoading={props.isLoading}
                    />
                </Cluster>
            }
        />
    )
}

/** Draws the onboarding progress card, or the single "all set" line once every step is done. */
export const OnboardingChecklistBase = (props: OnboardingChecklistBaseProps) => (
    <Checklist props={props.props} on={props.on} />
)

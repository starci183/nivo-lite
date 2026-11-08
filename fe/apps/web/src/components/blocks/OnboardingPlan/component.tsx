import { Button, RadioGroup, Stack, Text } from "@starci/grammar/common"
import { FirstRunCard } from "@/components/frames/FirstRunCard"

/** One choice of the plan step: a plan of the catalogue, Enterprise, or the free plan. */
export interface OnboardingPlanOption {
    readonly value: string
    readonly label: string
    readonly description: string
}

/** What the commit of the plan step does: open a URL (Enterprise contact, the ready step) or buy the chosen plan. */
export type OnboardingPlanCommit =
    | { readonly kind: "href"; readonly label: string; readonly href: string }
    | { readonly kind: "buy"; readonly label: string }

/** Copy, choices and state the plan step supplies. */
export interface OnboardingPlanBaseProps {
    readonly props: {
        readonly title: string
        readonly heading: string
        readonly description: string
        readonly choiceLabel: string
        readonly options: ReadonlyArray<OnboardingPlanOption>
        readonly selected: string | null
        readonly note: string
        readonly isLoading: boolean
        readonly isPending: boolean
        readonly backLabel: string
        readonly backHref: string
        readonly commit: OnboardingPlanCommit
    }
    readonly on: { readonly select: (value: string) => void; readonly buy: () => void }
}

/** Draws the plan step: the plans as rows to choose one from, the price note, and the ways back and on. */
export const OnboardingPlanBase = (props: OnboardingPlanBaseProps) => {
    const view = props.props
    const commit =
        view.commit.kind === "href" ? (
            <Button intent="commit" href={view.commit.href} isDisabled={view.isLoading}>
                {view.commit.label}
            </Button>
        ) : (
            <Button intent="commit" onPress={props.on.buy} isPending={view.isPending} isDisabled={view.isLoading}>
                {view.commit.label}
            </Button>
        )
    return (
        <FirstRunCard
            title={view.title}
            heading={view.heading}
            description={view.description}
            actions={
                <>
                    <Button intent="neutral" href={view.backHref}>
                        {view.backLabel}
                    </Button>
                    {commit}
                </>
            }
        >
            <Stack gap="row">
                <RadioGroup
                    name="plan"
                    label={view.choiceLabel}
                    appearance="rows"
                    options={view.options}
                    value={view.selected}
                    onValueChange={props.on.select}
                    isLoading={view.isLoading}
                />
                <Text tone="muted" size="sm">
                    {view.note}
                </Text>
            </Stack>
        </FirstRunCard>
    )
}

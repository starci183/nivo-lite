import type { HiringViews, HiringActions } from "@/modules/types"

type HiringOnboardingListProps = HiringViews["onboardingFields"] & {
    readonly on: HiringActions["onboardingActions"]
    readonly isLoading: boolean
}
import { Alert, Button, Checkbox, EmptyNotice, Meter, Section, Stack, type ListRowData } from "@starci/grammar/common"

/** One hired person with the steps before the first day. */
interface HiredPersonView {
    readonly id: string
    readonly name: string
    readonly job: string
    readonly contact: string
    readonly hasStaff: boolean
    readonly done: number
    readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string; readonly isDone: boolean }>
}

/** Resolved job and staff facts keep the original badge order, with no badge for a missing fact. */
const badgesOf = (person: HiredPersonView, hasStaffLabel: string): Pick<ListRowData, "badges"> => {
    if (person.job !== "" && person.hasStaff) {
        return {
            badges: [
                { label: person.job, tone: "neutral" },
                { label: hasStaffLabel, tone: "accent" },
            ],
        }
    }
    if (person.job !== "") return { badges: [{ label: person.job, tone: "neutral" }] }
    if (person.hasStaff) return { badges: [{ label: hasStaffLabel, tone: "accent" }] }
    return {}
}

/** Hired people share one collection; each person's checklist and staff command remain in the native row detail. */
export const HiringOnboardingList = (props: HiringOnboardingListProps) => {
    const { copy, people, isBusy, error } = props
    const { on } = props
    const items: Array<ListRowData> = people.map((person) => ({
        id: person.id,
        title: person.name,
        description: person.contact,
        ...badgesOf(person, copy.hasStaffLabel),
        detail: (
            <Stack gap="row">
                {person.hasStaff ? null : (
                    <Button
                        isLoading={props.isLoading}
                        intent="neutral"
                        size="sm"
                        isDisabled={isBusy}
                        onPress={() => on.linkStaff(person.id)}
                    >
                        {copy.createStaffLabel}
                    </Button>
                )}
                {person.steps.length === 0 ? null : (
                    <Meter
                        isLoading={props.isLoading}
                        label={copy.progressLabel}
                        value={person.done}
                        minValue={0}
                        maxValue={person.steps.length}
                        valueLabel={person.done + "/" + person.steps.length}
                    />
                )}
                <Stack gap="row">
                    {person.steps.map((step) => (
                        <Checkbox
                            key={step.id}
                            label={step.title}
                            isSelected={step.isDone}
                            isDisabled={isBusy}
                            onSelectedChange={(done) => on.toggle(step.id, done)}
                        />
                    ))}
                </Stack>
            </Stack>
        ),
    }))
    return (
        <Stack gap="row">
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={copy.errorTitle}
                    description={error}
                    dismissLabel={copy.dismissLabel}
                    onDismiss={on.clearError}
                />
            )}
            <Section
                isLoading={props.isLoading}
                kind="list"
                title={copy.title}
                items={items}
                empty={<EmptyNotice message={copy.emptyTitle} description={copy.emptyBody} />}
            />
        </Stack>
    )
}

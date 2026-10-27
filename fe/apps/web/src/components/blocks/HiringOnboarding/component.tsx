import { Alert, Badge, Button, Checkbox, EmptyNotice, Heading, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/modules/types"
import { CARD_CLASS_NAME, CHIPS_CLASS_NAME } from "./classNames"

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

/** What the connected block settled for the onboarding tab. */
export interface HiringOnboardingBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly people: ReadonlyArray<HiredPersonView>
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly toggle: (id: string, done: boolean) => void
        readonly linkStaff: (candidateId: string) => void
        readonly clearError: () => void
    }
}

/** Draws the onboarding tab: the people who said yes, each with the checklist of what to do before the first day. */
export const HiringOnboardingBase = (props: HiringOnboardingBaseProps) => {
    const { say, people, isBusy, error } = props.props
    const { on } = props
    return (
        <>
            <Heading level={2}>{say("onbTitle")}</Heading>
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={say("errorNotSaved")}
                    description={error}
                    dismissLabel={say("dismiss")}
                    onDismiss={on.clearError}
                />
            )}
            {people.length === 0 ? (
                <SurfaceCard ariaLabel={say("onbTitle")}>
                    <EmptyNotice message={say("onbEmptyTitle")} description={say("onbEmptyBody")} />
                </SurfaceCard>
            ) : null}
            {people.map((person) => (
                <SurfaceCard key={person.id} ariaLabel={person.name}>
                    <div className={CARD_CLASS_NAME}>
                        <div className={CHIPS_CLASS_NAME}>
                            <Text as="span" weight="semibold">
                                {person.name}
                            </Text>
                            {person.job === "" ? null : <Badge tone="neutral">{person.job}</Badge>}
                            <Text as="span" size="sm" tone="muted">
                                {person.contact}
                            </Text>
                            {person.hasStaff ? (
                                <Badge tone="accent">{say("onbHasStaff")}</Badge>
                            ) : (
                                <Button
                                    intent="neutral"
                                    size="sm"
                                    isDisabled={isBusy}
                                    onPress={() => on.linkStaff(person.id)}
                                >
                                    {say("onbCreateStaff")}
                                </Button>
                            )}
                        </div>
                        {person.steps.length === 0 ? null : (
                            <Meter
                                label={say("onbProgress")}
                                value={person.done}
                                minValue={0}
                                maxValue={person.steps.length}
                                valueLabel={`${person.done}/${person.steps.length}`}
                            />
                        )}
                        <div className={CARD_CLASS_NAME}>
                            {person.steps.map((step) => (
                                <Checkbox
                                    key={step.id}
                                    label={step.title}
                                    isSelected={step.isDone}
                                    isDisabled={isBusy}
                                    onSelectedChange={(done) => on.toggle(step.id, done)}
                                />
                            ))}
                        </div>
                    </div>
                </SurfaceCard>
            ))}
        </>
    )
}

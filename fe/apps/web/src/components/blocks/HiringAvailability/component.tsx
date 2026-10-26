import { Alert, Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME, GRID_CLASS_NAME } from "./classNames"

/** One weekday of the form. */
interface AvailabilityDayView {
    readonly weekday: number
    readonly label: string
    readonly text: string
    readonly isInvalid: boolean
}

/** What the connected block settled for the availability card. */
export interface HiringAvailabilityBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly members: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly who: string
        readonly days: ReadonlyArray<AvailabilityDayView>
        readonly canSave: boolean
        readonly isBusy: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly member: (id: string) => void
        readonly text: (weekday: number, text: string) => void
        readonly save: () => void
    }
}

/** Draws the card where each member says when they are free to interview, one weekday per line (in Vietnam time). */
export const HiringAvailabilityBase = (props: HiringAvailabilityBaseProps) => {
    const { say, members, who, days, canSave, isBusy, error, notice } = props.props
    const { on } = props
    return (
        <SurfaceCard label={say("availTitle")}>
            <div className={FORM_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {say("availHint")}
                </Text>
                {members.length === 0 ? (
                    <Text tone="muted">{say("availNoMembers")}</Text>
                ) : (
                    <>
                        <Select
                            label={say("availMember")}
                            options={members}
                            value={who}
                            onValueChange={(id) => on.member(id ?? who)}
                        />
                        <div className={GRID_CLASS_NAME}>
                            {days.map((day) => (
                                <Input
                                    key={`${who}-${day.weekday}`}
                                    id={`av-${day.weekday}`}
                                    name={`av_${day.weekday}`}
                                    label={day.label}
                                    placeholder={say("availPlaceholder")}
                                    isError={day.isInvalid}
                                    errorMessage={day.isInvalid ? say("availInvalid") : undefined}
                                    value={day.text}
                                    onValueChange={(text) => on.text(day.weekday, text)}
                                />
                            ))}
                        </div>
                        {error === null ? null : (
                            <Alert tone="negative" title={say("errorNotSaved")} description={error} />
                        )}
                        {notice === null ? null : <Alert tone="affirmative" title={notice} />}
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button
                                intent="neutral"
                                isPending={isBusy}
                                isDisabled={isBusy || !canSave}
                                onPress={on.save}
                            >
                                {say("availSave")}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </SurfaceCard>
    )
}

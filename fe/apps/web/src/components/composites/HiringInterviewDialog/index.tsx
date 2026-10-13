import { Alert, Dialog, Input, NumberField, SegmentedControl, Select } from "@starci/grammar/common"
import { HiringDialogFooter } from "@/components/branches/HiringDialogFooter"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { InterviewValues, RequestOutcomeView } from "@/hooks/hiringCandidate"
import { FORM_CLASS_NAME } from "./classNames"

/** One option of a choice field. */
interface Option {
    readonly id: string
    readonly label: string
}

/** The words, values and state of the interview request dialog. */
export interface HiringInterviewDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly name: string
        readonly members: ReadonlyArray<Option>
        readonly modes: ReadonlyArray<Option>
        readonly values: InterviewValues
        readonly outcome: RequestOutcomeView | null
        readonly canSend: boolean
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly text: (name: FieldOf<InterviewValues, string>, value: string) => void
        readonly number: (name: FieldOf<InterviewValues, number>, value: number) => void
        readonly send: () => void
        readonly close: () => void
    }
}

/** The dialog that asks the back end to propose three interview times to a candidate. */
export const HiringInterviewDialog = (props: HiringInterviewDialogProps) => {
    const { say, name, members, modes, values, outcome, canSend, isBusy, error } = props.props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={say("ivTitle", { name })}
            closeLabel={say("close")}
            description={say("ivHint")}
            footer={() => (
                <HiringDialogFooter
                    say={say}
                    sendKey="ivSend"
                    isDone={outcome !== null}
                    canSend={canSend}
                    isBusy={isBusy}
                    onSend={on.send}
                    onClose={on.close}
                />
            )}
        >
            <div className={FORM_CLASS_NAME}>
                {error === null ? null : <Alert tone="negative" title={say("ivFailed")} description={error} />}
                {outcome === null ? (
                    <>
                        <Select
                            label={say("ivInterviewer")}
                            variant="secondary"
                            options={members}
                            value={values.interviewerUserId}
                            onValueChange={(id) => on.text("interviewerUserId", id ?? "")}
                        />
                        <SegmentedControl
                            label={say("ivModeLabel")}
                            options={modes.map((mode) => ({ value: mode.id, label: mode.label }))}
                            value={values.mode}
                            onValueChange={(mode) => on.text("mode", mode)}
                        />
                        <Input
                            id="iv-loc"
                            name="location"
                            label={say(values.mode === "online" ? "ivLink" : "ivPlace")}
                            variant="secondary"
                            value={values.location}
                            onValueChange={(location) => on.text("location", location)}
                        />
                        <NumberField
                            label={say("ivDuration")}
                            variant="secondary"
                            minValue={15}
                            maxValue={180}
                            step={15}
                            value={values.durationMin}
                            onValueChange={(value) => on.number("durationMin", Number.isFinite(value) ? value : 30)}
                        />
                    </>
                ) : (
                    <Alert
                        tone={outcome.status === "done" ? "affirmative" : "informative"}
                        title={say(outcome.status === "done" ? "ivDone" : "ivWaiting")}
                        description={outcome.summary}
                    />
                )}
            </div>
        </Dialog>
    )
}

import type { HiringViews, HiringActions } from "@/modules/types"

import { Stack, Alert, Dialog, Input, NumberField, SegmentedControl, Select } from "@starci/grammar/common"

import { HiringDialogFooter } from "@/components/branches/HiringDialogFooter"

/** The words, values and state of the interview request dialog. */
type HiringInterviewDialogProps = HiringViews["interviewFields"] & {
    readonly on: HiringActions["interviewActions"]
}

/** The dialog that asks the back end to propose three interview times to a candidate. */
export const HiringInterviewDialog = (props: HiringInterviewDialogProps) => {
    const { copy, members, modes, values, outcome, canSend, isBusy, error } = props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={props.title}
            closeLabel={copy.close}
            description={copy.ivHint}
            footer={
                <HiringDialogFooter
                    copy={copy}
                    sendLabel={copy.ivSend}
                    isDone={outcome !== null}
                    canSend={canSend}
                    isBusy={isBusy}
                    onSend={on.send}
                    onClose={on.close}
                />
            }
        >
            <Stack gap="row">
                {error === null ? null : <Alert tone="negative" title={copy.ivFailed} description={error} />}
                {outcome === null ? (
                    <>
                        <Select
                            label={copy.ivInterviewer}
                            options={members}
                            value={values.interviewerUserId}
                            onValueChange={(id) => on.text("interviewerUserId", id ?? "")}
                        />
                        <SegmentedControl
                            label={copy.ivModeLabel}
                            options={modes.map((mode) => ({ value: mode.id, label: mode.label }))}
                            value={values.mode}
                            onValueChange={(mode) => on.text("mode", mode)}
                        />
                        <Input
                            id="iv-loc"
                            name="location"
                            label={values.mode === "online" ? copy.ivLink : copy.ivPlace}
                            value={values.location}
                            onValueChange={(location) => on.text("location", location)}
                        />
                        <NumberField
                            label={copy.ivDuration}
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
                        title={outcome.status === "done" ? copy.ivDone : copy.ivWaiting}
                        description={outcome.summary}
                    />
                )}
            </Stack>
        </Dialog>
    )
}

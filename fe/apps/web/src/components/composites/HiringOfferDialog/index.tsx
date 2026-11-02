import type { HiringViews, HiringActions } from "@/modules/types"

import { Stack, Grid, Alert, Dialog, Input, Textarea } from "@starci/grammar/common"

import { HiringDialogFooter } from "@/components/branches/HiringDialogFooter"

/** The words, values and state of the offer request dialog. */
type HiringOfferDialogProps = HiringViews["offerFields"] & {
    readonly on: HiringActions["offerActions"]
}

/** The dialog that asks the back end to draft an offer letter from the terms below; the letter is sent only once approved. */
export const HiringOfferDialog = (props: HiringOfferDialogProps) => {
    const { copy, values, outcome, canSend, isBusy, error } = props
    const { on } = props
    const isWaiting = outcome?.status === "waiting_decision"
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={props.title}
            closeLabel={copy.close}
            description={copy.offerHint}
            footer={
                <HiringDialogFooter
                    copy={copy}
                    sendLabel={copy.offerSend}
                    isDone={outcome !== null}
                    canSend={canSend}
                    isBusy={isBusy}
                    onSend={on.send}
                    onClose={on.close}
                />
            }
        >
            {renderHiringOfferDialogFields({ error, copy, outcome, values, on, isWaiting })}
        </Dialog>
    )
}

/** Renders the HiringOfferDialog fields section. */
interface OfferFieldsProps {
    readonly error: HiringOfferDialogProps["error"]
    readonly copy: HiringViews["workbenchCopy"]
    readonly outcome: HiringOfferDialogProps["outcome"]
    readonly values: HiringOfferDialogProps["values"]
    readonly on: HiringOfferDialogProps["on"]
    readonly isWaiting: boolean
}

const renderHiringOfferDialogFields = (props: OfferFieldsProps) => {
    const { error, copy, outcome, values, on, isWaiting } = props
    return (
        <Stack gap="row">
            {error === null ? null : <Alert tone="negative" title={copy.offerFailed} description={error} />}
            {outcome === null ? (
                <>
                    <Input
                        id="of-title"
                        name="title"
                        label={copy.offerRole}
                        value={values.title}
                        onValueChange={(title) => on.text("title", title)}
                    />
                    <Input
                        id="of-pay"
                        name="pay"
                        label={copy.offerPay}
                        description={copy.offerPayExample}
                        isRequired
                        value={values.pay}
                        onValueChange={(pay) => on.text("pay", pay)}
                    />
                    <Grid kind="form" columns={2}>
                        <Input
                            id="of-start"
                            name="start_date"
                            label={copy.offerStart}
                            value={values.startDate}
                            onValueChange={(startDate) => on.text("startDate", startDate)}
                        />
                        <Input
                            id="of-prob"
                            name="probation"
                            label={copy.offerProbation}
                            value={values.probation}
                            onValueChange={(probation) => on.text("probation", probation)}
                        />
                    </Grid>
                    <Textarea
                        label={copy.offerNote}
                        rows={2}
                        value={values.note}
                        onValueChange={(note) => on.text("note", note)}
                    />
                </>
            ) : (
                <Alert
                    tone={isWaiting ? "cautionary" : "affirmative"}
                    title={isWaiting ? copy.offerWaiting : copy.offerHandled}
                    description={isWaiting ? `${outcome.summary} ${copy.offerOpenDecisions}` : outcome.summary}
                />
            )}
        </Stack>
    )
}

import { Alert, Dialog, Input, Textarea } from "@starci/grammar/common"
import { HiringDialogFooter } from "@/components/branches/HiringDialogFooter"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { OfferValues, RequestOutcomeView } from "@/hooks/hiringCandidate"
import { FORM_CLASS_NAME, GRID_CLASS_NAME } from "./classNames"

/** The words, values and state of the offer request dialog. */
export interface HiringOfferDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly name: string
        readonly values: OfferValues
        readonly outcome: RequestOutcomeView | null
        readonly canSend: boolean
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly text: (name: FieldOf<OfferValues, string>, value: string) => void
        readonly send: () => void
        readonly close: () => void
    }
}

/** The dialog that asks the back end to draft an offer letter from the terms below; the letter is sent only once approved. */
export const HiringOfferDialog = (props: HiringOfferDialogProps) => {
    const { say, name, values, outcome, canSend, isBusy, error } = props.props
    const { on } = props
    const isWaiting = outcome?.status === "waiting_decision"
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={say("offerTitle", { name })}
            closeLabel={say("close")}
            description={say("offerHint")}
            footer={() => (
                <HiringDialogFooter
                    say={say}
                    sendKey="offerSend"
                    isDone={outcome !== null}
                    canSend={canSend}
                    isBusy={isBusy}
                    onSend={on.send}
                    onClose={on.close}
                />
            )}
        >
            {renderHiringOfferDialogFields(error, say, outcome, values, on, isWaiting)}
        </Dialog>
    )
}

/** Renders the HiringOfferDialog fields section. */
const renderHiringOfferDialogFields = (
    error: HiringOfferDialogProps["props"]["error"],
    say: NonNullable<HiringOfferDialogProps["props"]["say"]>,
    outcome: HiringOfferDialogProps["props"]["outcome"],
    values: NonNullable<HiringOfferDialogProps["props"]["values"]>,
    on: NonNullable<HiringOfferDialogProps["on"]>,
    isWaiting: boolean,
) => (
    <div className={FORM_CLASS_NAME}>
        {error === null ? null : <Alert tone="negative" title={say("offerFailed")} description={error} />}
        {outcome === null ? (
            <>
                <Input
                    id="of-title"
                    name="title"
                    label={say("offerRole")}
                    variant="secondary"
                    value={values.title}
                    onValueChange={(title) => on.text("title", title)}
                />
                <Input
                    id="of-pay"
                    name="pay"
                    label={say("offerPay")}
                    hint={say("offerPayExample")}
                    variant="secondary"
                    isRequired
                    value={values.pay}
                    onValueChange={(pay) => on.text("pay", pay)}
                />
                <div className={GRID_CLASS_NAME}>
                    <Input
                        id="of-start"
                        name="start_date"
                        label={say("offerStart")}
                        variant="secondary"
                        value={values.startDate}
                        onValueChange={(startDate) => on.text("startDate", startDate)}
                    />
                    <Input
                        id="of-prob"
                        name="probation"
                        label={say("offerProbation")}
                        variant="secondary"
                        value={values.probation}
                        onValueChange={(probation) => on.text("probation", probation)}
                    />
                </div>
                <Textarea
                    label={say("offerNote")}
                    variant="secondary"
                    rows={2}
                    value={values.note}
                    onValueChange={(note) => on.text("note", note)}
                />
            </>
        ) : (
            <Alert
                tone={isWaiting ? "cautionary" : "affirmative"}
                title={say(isWaiting ? "offerWaiting" : "offerHandled")}
                description={isWaiting ? `${outcome.summary} ${say("offerOpenDecisions")}` : outcome.summary}
            />
        )}
    </div>
)

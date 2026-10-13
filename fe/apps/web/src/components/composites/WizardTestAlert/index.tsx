import { Alert } from "@starci/grammar/common"

/** What the receiver of a test send answered, already in sentences. */
type WizardTestAlertProps = {
    readonly isOk: boolean
    readonly title: string
    /** The reason (when it failed) and how long the receiver took. */
    readonly description: string
}

/** What the receiver answered to a test send: affirmative on 2xx, otherwise the reason. */
export const WizardTestAlert = (props: WizardTestAlertProps) => (
    <Alert tone={props.isOk ? "affirmative" : "negative"} title={props.title} description={props.description} />
)

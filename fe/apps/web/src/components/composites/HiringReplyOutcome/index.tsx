import { Alert } from "@starci/grammar/common"

/** What the candidate's answer came to: sent, or refused. */
interface HiringReplyOutcomeProps {
    readonly outcome: { readonly isOk: boolean; readonly text: string }
}

/** The line after an answer was sent: the thanks or the reason it did not go. */
export const HiringReplyOutcome = (props: HiringReplyOutcomeProps) => (
    <Alert tone={props.outcome.isOk ? "affirmative" : "negative"} title={props.outcome.text} />
)

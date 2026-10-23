import { Alert, Button, Text, TextAction } from "@starci/grammar/common"
import { CHECK_ACTIONS_CLASS_NAME, CHECK_CENTER_CLASS_NAME } from "./classNames"

/** Copy, state and commands of the "check your email" body. */
export interface CheckEmailProps {
    readonly text: string
    readonly hint?: string
    /** A result note under the text: tone, title and description. */
    readonly notice?:
        { readonly tone: "affirmative" | "negative"; readonly title: string; readonly text: string } | undefined
    readonly resendLabel: string
    readonly isPending: boolean
    readonly isWaiting: boolean
    readonly wrongEmailLabel: string
    readonly backLabel: string
    readonly backHref: string
    readonly onResend: () => void
    readonly onChangeEmail: () => void
}

/** "Check your email" body: the message, a resend button (disabled during its cooldown) and a way back. */
export const CheckEmail = (props: CheckEmailProps) => (
    <div className={CHECK_ACTIONS_CLASS_NAME}>
        <Text>{props.text}</Text>
        {props.hint === undefined ? null : (
            <Text size="sm" tone="muted">
                {props.hint}
            </Text>
        )}
        {props.notice === undefined ? null : (
            <Alert title={props.notice.title} description={props.notice.text} tone={props.notice.tone} />
        )}
        <Button
            variant="secondary"
            width="fill"
            isPending={props.isPending}
            isDisabled={props.isWaiting}
            onPress={props.onResend}
        >
            {props.resendLabel}
        </Button>
        <div className={CHECK_CENTER_CLASS_NAME}>
            <TextAction onPress={props.onChangeEmail}>{props.wrongEmailLabel}</TextAction>
            <TextAction href={props.backHref}>{props.backLabel}</TextAction>
        </div>
    </div>
)

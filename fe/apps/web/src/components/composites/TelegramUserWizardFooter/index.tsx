import { backAction, closeAction, nextAction, WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import type { TelegramUserWizardCopy, TelegramUserLoginView } from "@/modules/types"

/** Only the facts, labels and commands that determine this wizard's footer. */
interface TelegramUserWizardFooterProps {
    readonly index: number
    readonly isConfigured: boolean
    readonly loginStage: TelegramUserLoginView["stage"]
    readonly valid: Readonly<Record<"consent" | "phone" | "code" | "password", boolean>>
    readonly isPending: boolean
    readonly canGoOn: boolean
    readonly canRetryChats: boolean
    readonly isLoading: boolean
    readonly text: Pick<
        TelegramUserWizardCopy,
        | "close"
        | "next"
        | "back"
        | "sendCode"
        | "confirmCode"
        | "signIn"
        | "cancelLogin"
        | "resend"
        | "chatsRetry"
        | "save"
        | "done"
    >
    readonly onGo: (step: number) => void
    readonly onClose: () => void
    readonly onSendCode: () => void
    readonly onConfirmCode: () => void
    readonly onConfirmPassword: () => void
    readonly onResend: () => void
    readonly onCancelLogin: () => void
    readonly onReloadChats: () => void
    readonly onSave: () => void
    readonly onFinish: () => void
}

const loginActionsOf = (props: TelegramUserWizardFooterProps): ReadonlyArray<WizardAction> => {
    const { text, isPending, valid } = props
    const cancel: WizardAction = {
        id: "cancel",
        label: text.cancelLogin,
        intent: "dismiss",
        isDisabled: isPending,
        onPress: props.onCancelLogin,
    }
    if (props.loginStage === "phone") {
        return [
            nextAction(text.sendCode, props.onSendCode, { isPending, isDisabled: !valid.phone }),
            backAction(text.back, isPending, () => props.onGo(0)),
        ]
    }
    if (props.loginStage === "code") {
        const resend: WizardAction = {
            id: "resend",
            label: text.resend,
            intent: "alternative",
            isDisabled: isPending,
            onPress: props.onResend,
        }
        return [
            nextAction(text.confirmCode, props.onConfirmCode, { isPending, isDisabled: !valid.code }),
            resend,
            cancel,
        ]
    }
    return [nextAction(text.signIn, props.onConfirmPassword, { isPending, isDisabled: !valid.password }), cancel]
}

const actionsOf = (props: TelegramUserWizardFooterProps): ReadonlyArray<WizardAction> => {
    const { text, isPending } = props
    const close = closeAction(text.close, props.onClose)
    if (!props.isConfigured) return [nextAction(text.close, props.onClose)]
    if (props.index === 0)
        return [nextAction(text.next, () => props.onGo(1), { isDisabled: !props.valid.consent }), close]
    if (props.index === 1) return loginActionsOf(props)
    if (props.index === 2) {
        const goOn = nextAction(text.next, () => props.onGo(3), { isDisabled: !props.canGoOn })
        const retry: WizardAction = {
            id: "retry",
            label: text.chatsRetry,
            intent: "alternative",
            onPress: props.onReloadChats,
        }
        return props.canRetryChats ? [goOn, retry, close] : [goOn, close]
    }
    if (props.index === 3)
        return [
            nextAction(text.save, props.onSave, { isPending }),
            backAction(text.back, isPending, () => props.onGo(2)),
        ]
    return [nextAction(text.done, props.onFinish, { isPending })]
}

/** Owns the unchanged consent, sign-in, retry, save and completion command policy. */
export const TelegramUserWizardFooter = (props: TelegramUserWizardFooterProps) => (
    <WizardFooter actions={actionsOf(props)} isLoading={props.isLoading} />
)

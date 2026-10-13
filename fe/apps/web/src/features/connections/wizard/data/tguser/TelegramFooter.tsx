"use client"

import { useTranslations } from "next-intl"
import { Button } from "@starci/grammar/common"
import type { TelegramUserWizardState } from "@/hooks/telegram-user-wizard"

/** Props for {@link TelegramFooter}. */
export type TelegramFooterProps = {
    readonly wizard: TelegramUserWizardState
    readonly onClose: (changed: boolean) => void
}

/** The login footer: send the code, confirm it, or sign in with the two-step password. */
const LoginFooter = ({ wizard }: Pick<TelegramFooterProps, "wizard">) => {
    const t = useTranslations("connectorTelegramUser")
    const { on, isPending, forms } = wizard
    const { stage, ...act } = wizard.login
    if (stage === "phone") {
        return (
            <>
                <Button
                    variant="primary"
                    isPending={isPending}
                    isDisabled={!forms.phone.formState.isValid}
                    onPress={act.sendCode}
                >
                    {t("sendCode")}
                </Button>
                <Button variant="outline" isDisabled={isPending} onPress={() => on.go(0)}>
                    {t("back")}
                </Button>
            </>
        )
    }
    if (stage === "code") {
        return (
            <>
                <Button
                    variant="primary"
                    isPending={isPending}
                    isDisabled={!forms.code.formState.isValid}
                    onPress={act.confirmCode}
                >
                    {t("confirmCode")}
                </Button>
                <Button variant="outline" isDisabled={isPending} onPress={act.resend}>
                    {t("resend")}
                </Button>
                <Button variant="ghost" isDisabled={isPending} onPress={act.cancel}>
                    {t("cancelLogin")}
                </Button>
            </>
        )
    }
    return (
        <>
            <Button
                variant="primary"
                isPending={isPending}
                isDisabled={!forms.password.formState.isValid}
                onPress={act.confirmPassword}
            >
                {t("signIn")}
            </Button>
            <Button variant="ghost" isDisabled={isPending} onPress={act.cancel}>
                {t("cancelLogin")}
            </Button>
        </>
    )
}

/** The footer buttons of the personal Telegram wizard for the current step. */
export const TelegramFooter = ({ wizard, onClose }: TelegramFooterProps) => {
    const t = useTranslations("connectorTelegramUser")
    const { on, isPending, index, forms } = wizard
    const close = (
        <Button variant="ghost" onPress={() => onClose(false)}>
            {t("close")}
        </Button>
    )
    if (index === 0) {
        return (
            <>
                <Button variant="primary" isDisabled={!forms.consent.formState.isValid} onPress={() => on.go(1)}>
                    {t("next")}
                </Button>
                {close}
            </>
        )
    }
    if (index === 1) return <LoginFooter wizard={wizard} />
    if (index === 2) {
        return (
            <>
                <Button
                    variant="primary"
                    isDisabled={wizard.picks.picked.length === 0 || wizard.picks.loading}
                    onPress={() => on.go(3)}
                >
                    {t("next")}
                </Button>
                {wizard.picks.failed ? (
                    <Button variant="outline" onPress={on.reloadChats}>
                        {t("chatsRetry")}
                    </Button>
                ) : null}
                {close}
            </>
        )
    }
    if (index === 3) {
        return (
            <>
                <Button variant="primary" isPending={isPending} onPress={on.save}>
                    {t("save")}
                </Button>
                <Button variant="outline" isDisabled={isPending} onPress={() => on.go(2)}>
                    {t("back")}
                </Button>
            </>
        )
    }
    return (
        <Button variant="primary" isPending={isPending} onPress={on.finish}>
            {t("done")}
        </Button>
    )
}

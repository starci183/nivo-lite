"use client"

import { useTranslations } from "next-intl"
import { Input, Text } from "@starci/grammar/common"
import type { TelegramUserWizardState } from "@/hooks/telegram-user-wizard"
import { FIELDS_CLASS } from "../../classNames"

/** Props for {@link LoginStep}. */
export type LoginStepProps = {
    readonly wizard: TelegramUserWizardState
}

/** Step 2: the phone number, then the code Telegram sent, then (when the account has it) the two-step password. */
export const LoginStep = ({ wizard }: LoginStepProps) => {
    const t = useTranslations("connectorTelegramUser")
    const { phone, code, password } = wizard.forms
    const sentLine = {
        app: t("codeSentApp"),
        sms: t("codeSentSms"),
        resent: t("resent"),
    }
    return (
        <div className={FIELDS_CLASS}>
            {wizard.login.stage === "phone" ? (
                <Input
                    id="tgu-phone"
                    name="phone"
                    kind="tel"
                    label={t("phoneLabel")}
                    variant="secondary"
                    hint={t("phoneHint")}
                    isDisabled={wizard.isPending}
                    value={phone.watch("phone")}
                    onValueChange={(value) => phone.setValue("phone", value, { shouldValidate: true })}
                />
            ) : null}
            {wizard.login.stage === "code" ? (
                <>
                    {wizard.login.sentVia === null ? null : (
                        <Text size="sm" live="polite">
                            {sentLine[wizard.login.sentVia]}
                        </Text>
                    )}
                    <Input
                        id="tgu-code"
                        name="code"
                        kind="code"
                        label={t("codeLabel")}
                        variant="secondary"
                        hint={t("codeHint")}
                        isDisabled={wizard.isPending}
                        value={code.watch("code")}
                        onValueChange={(value) => code.setValue("code", value, { shouldValidate: true })}
                    />
                </>
            ) : null}
            {wizard.login.stage === "password" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("passwordTitle")}
                    </Text>
                    <Input
                        id="tgu-password"
                        name="password"
                        kind="password"
                        label={t("passwordLabel")}
                        variant="secondary"
                        hint={t("passwordHint")}
                        isDisabled={wizard.isPending}
                        value={password.watch("password")}
                        onValueChange={(value) => password.setValue("password", value, { shouldValidate: true })}
                    />
                </>
            ) : null}
        </div>
    )
}

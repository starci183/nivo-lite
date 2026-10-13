"use client"

import { useTranslations } from "next-intl"
import { CheckboxGroup, Input, Text } from "@starci/grammar/common"
import type { TelegramUserWizardState } from "@/hooks/telegram-user-wizard"
import { FIELDS_CLASS } from "../../classNames"

/** Props for {@link ConsentStep}. */
export type ConsentStepProps = {
    readonly wizard: TelegramUserWizardState
}

/** Step 1: the connection name and the commitment the owner agrees to before logging in. */
export const ConsentStep = ({ wizard }: ConsentStepProps) => {
    const t = useTranslations("connectorTelegramUser")
    const form = wizard.forms.consent
    const name = form.watch("name")
    const consent = form.watch("consent")
    return (
        <>
            <div className={FIELDS_CLASS}>
                <Input
                    id="tgu-name"
                    name="name"
                    label={t("nameLabel")}
                    variant="secondary"
                    hint={t("nameHint")}
                    isDisabled={wizard.isPending}
                    value={name}
                    onValueChange={(value) => form.setValue("name", value, { shouldValidate: true })}
                />
            </div>
            <Text size="sm" weight="semibold">
                {t("consentTitle")}
            </Text>
            <Text size="sm">{t("consent1")}</Text>
            <Text size="sm">{t("consent2")}</Text>
            <Text size="sm">{t("consent3")}</Text>
            <CheckboxGroup
                variant="secondary"
                label={t("consentTitle")}
                isLabelHidden
                options={[{ value: "yes", label: t("consentLabel") }]}
                value={consent ? ["yes"] : []}
                onValueChange={(value) => form.setValue("consent", value.includes("yes"), { shouldValidate: true })}
            />
        </>
    )
}

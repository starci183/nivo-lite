"use client"

import { useLocale, useTranslations } from "next-intl"
import { Alert, Button, Text } from "@starci/grammar/common"
import { useTelegramUserBoot } from "@/hooks/telegram-user-wizard"
import { PROVIDERS } from "@/lib/connection-providers"
import { WizardFrame } from "../WizardFrame"
import { TelegramUserBody } from "./tguser/TelegramUserBody"
import type { DataWizardProps } from "./types"

/** Setup of a personal Telegram connection (owner only): consent, phone login, chat picks, schedule, agents. */
export const TelegramUserWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
    const t = useTranslations("connectorTelegramUser")
    const w = useTranslations("connectionWizard")
    const locale = useLocale()
    const boot = useTelegramUserBoot(resumeId)
    const title = w("title", { provider: PROVIDERS.telegram_user.title[locale === "en" ? "en" : "vi"] })
    const names = [t("stepConsent"), t("stepLogin"), t("stepChats"), t("stepSchedule"), t("stepAgent")]

    if (boot.status === "ready") {
        return (
            <TelegramUserBody
                title={title}
                agents={agents}
                resumeId={resumeId}
                initial={boot.initial}
                onClose={onClose}
            />
        )
    }
    const closeButton = (
        <Button variant="primary" onPress={() => onClose(false)}>
            {t("close")}
        </Button>
    )
    return (
        <WizardFrame title={title} steps={names} index={0} footer={boot.status === "loading" ? null : closeButton}>
            {boot.status === "loading" ? (
                <Text size="sm" live="polite">
                    {t("loading")}
                </Text>
            ) : null}
            {boot.status === "unconfigured" ? (
                <Alert tone="negative" title={t("notConfiguredTitle")} description={t("notConfiguredBody")} />
            ) : null}
            {boot.status === "failed" && boot.error !== null ? <Alert tone="negative" title={boot.error} /> : null}
        </WizardFrame>
    )
}

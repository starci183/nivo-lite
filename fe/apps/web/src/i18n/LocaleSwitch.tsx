"use client"

import { SegmentedControl } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { setLocale } from "./actions"
import { useLocale } from "./client"

/** VI | EN segmented switch for the top bar and the login page; the choice lives in the NIVO_LOCALE cookie, never in the URL. */
export const LocaleSwitch = () => {
    const t = useTranslations("app")
    const locale = useLocale()
    const router = useRouter()
    const [pending, start] = useTransition()
    return (
        <SegmentedControl
            label={t("localeLabel")}
            isLabelHidden
            isDisabled={pending}
            value={locale}
            options={[
                { value: "vi", label: t("localeViShort"), accessibleLabel: t("localeViName") },
                { value: "en", label: t("localeEnShort"), accessibleLabel: t("localeEnName") },
            ]}
            onValueChange={(next) => {
                if (next === locale) return
                start(async () => {
                    await setLocale(next)
                    router.refresh()
                })
            }}
        />
    )
}

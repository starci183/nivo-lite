"use client"

import { useTranslations } from "next-intl"
import { useHiringSay, useHiringWorkbench } from "@/hooks/hiring"
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS, settingsDefaults, useHiringSettings } from "@/hooks/hiringSettings"
import { useHiringSettingsForm } from "@/hooks/rhf"
import { HiringSettingsBase } from "./component"

/** The connected settings card: a form over the stored settings, saved through the back end GraphQL API (outcome toasted). */
export const HiringSettings = () => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const { board } = useHiringWorkbench()
    const form = useHiringSettingsForm(settingsDefaults(board.settings))
    const settings = useHiringSettings(form)
    return (
        <HiringSettingsBase
            props={{
                say,
                slugHint: t("setSlugHint", {
                    origin: board.origin,
                    slug: settings.values.publicSlug === "" ? t("setSlugExample") : settings.values.publicSlug,
                }),
                values: settings.values,
                retentionMin: RETENTION_MIN_DAYS,
                retentionMax: RETENTION_MAX_DAYS,
                isBusy: settings.isPending,
                error: settings.error,
                notice: settings.notice,
            }}
            on={{ text: settings.setText, number: settings.setNumber, flag: settings.setFlag, save: settings.save }}
        />
    )
}

"use client"

import { useTranslations } from "next-intl"
import { useHiringSay } from "@/hooks/hiring"
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS, settingsDefaults, useHiringSettings } from "@/hooks/hiringSettings"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"
import { useHiringSettingsForm } from "@/hooks/rhf"
import { HiringSettingsBase } from "./component"

/** The workbench the card reads. */
interface HiringSettingsProps {
    readonly data: HiringWorkbenchData
}

/** The connected settings card: a form over the stored settings, saved through the back end GraphQL API (outcome toasted). */
export const HiringSettings = (props: HiringSettingsProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const form = useHiringSettingsForm(settingsDefaults(props.data.settings))
    const settings = useHiringSettings(form)
    return (
        <HiringSettingsBase
            props={{
                say,
                slugHint: t("setSlugHint", {
                    origin: props.data.origin,
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

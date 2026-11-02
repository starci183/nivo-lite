"use client"
import { useTranslations } from "next-intl"
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS, settingsDefaults, useHiringSettings } from "@/hooks/hiringSettings"
import { useHiringSettingsForm } from "@/hooks/rhf"
import type { HiringViewInput } from "./hiringWorkbench.shared"
import type { FieldOf } from "@/modules/types"

import { useFeatureReset } from "@/hooks/reuseables"
import type { SettingsValues } from "@/hooks/hiringSettings"

type ResolvedActions = {
    readonly text: (name: FieldOf<SettingsValues, string>, value: string) => void
    readonly number: (name: FieldOf<SettingsValues, number>, value: number) => void
    readonly flag: (name: FieldOf<SettingsValues, boolean>, value: boolean) => void
    readonly save: () => void
}

/** Owns HiringSettings's resolved data, commands and actual panel activation. */
export const useHiringSettingsView = (input: HiringViewInput) => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const board = input.board
    const form = useHiringSettingsForm(settingsDefaults(board.settings))
    const settings = useHiringSettings(form, owner)

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => form.reset(settingsDefaults(board.settings)),
    })

    const props = {
        copy: input.copy,
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
    }
    const on: ResolvedActions = {
        text: settings.setText,
        number: settings.setNumber,
        flag: settings.setFlag,
        save: settings.save,
    }
    return { props, on }
}

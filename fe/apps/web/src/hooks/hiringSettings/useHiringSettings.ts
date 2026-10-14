"use client"

import { useTranslations } from "next-intl"
import type { UseFormReturn } from "react-hook-form"
import { useHiringRun } from "@/hooks/hiring"
import type { FieldOf } from "@/hooks/hiring"
import { useMutateSaveHiringSettingsSwr } from "@/hooks/swr"
import { toSettingsInput } from "./hiringSettings.shared"
import type { SettingsValues } from "./hiringSettings.shared"

/** The settings form: its values, every change of them and the save. */
export const useHiringSettings = (form: UseFormReturn<SettingsValues>) => {
    const t = useTranslations("hiring")
    const run = useHiringRun()
    const { trigger } = useMutateSaveHiringSettingsSwr()
    const submit = form.handleSubmit(async (values) => {
        await run.exec(
            () => trigger(toSettingsInput(values)),
            () => t("settingsSaved"),
        )
    })
    return {
        values: form.watch(),
        isPending: run.isPending,
        error: run.error,
        notice: run.notice,
        setText: (name: FieldOf<SettingsValues, string>, value: string) => {
            run.clear()
            form.setValue(name, value, { shouldValidate: true })
        },
        setNumber: (name: FieldOf<SettingsValues, number>, value: number) => {
            run.clear()
            form.setValue(name, value, { shouldValidate: true })
        },
        setFlag: (name: FieldOf<SettingsValues, boolean>, value: boolean) => {
            run.clear()
            form.setValue(name, value, { shouldValidate: true })
        },
        save: () => void submit(),
    }
}

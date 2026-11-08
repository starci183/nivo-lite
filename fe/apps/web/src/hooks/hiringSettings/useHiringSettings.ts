"use client"
import { useGraphQLWithToast } from "@/modules/toast"

import { useFeatureLifetime } from "@/hooks/reuseables"
import { type HiringOwner, useHiringRun } from "@/hooks/hiring"

import { useTranslations } from "next-intl"
import type { UseFormReturn } from "react-hook-form"
import type { FieldOf } from "@/modules/types"
import { useMutateSaveHiringSettingsSwr } from "@/hooks/swr"
import { toSettingsInput, type SettingsValues } from "./hiringSettings.shared"

/** The view `useHiringSettings` returns. */
export interface HiringSettingsView {
    values: SettingsValues
    isPending: boolean
    error: string | null
    notice: string | null
    setText: (name: FieldOf<SettingsValues, string>, value: string) => void
    setNumber: (name: FieldOf<SettingsValues, number>, value: number) => void
    setFlag: (name: FieldOf<SettingsValues, boolean>, value: boolean) => void
    save: () => void
}

/** The settings form: its values, every change of them and the save. */
export const useHiringSettings = (form: UseFormReturn<SettingsValues>, owner?: HiringOwner): HiringSettingsView => {
    const t = useTranslations("hiring")
    const run = useHiringRun(owner)
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const { trigger } = useMutateSaveHiringSettingsSwr()
    const submit = (isCurrent: () => boolean) =>
        form.handleSubmit((values) => {
            if (!isCurrent()) return
            run.dispatch(
                () => trigger(toSettingsInput(values)),
                () => t("settingsSaved"),
            )
        })
    return {
        values: form.watch(),
        isPending: run.isPending || form.formState.isSubmitting,
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
        save: () => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return
            submit(isCurrent)().catch((error) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
    }
}

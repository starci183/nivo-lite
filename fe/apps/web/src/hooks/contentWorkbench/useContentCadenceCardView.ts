"use client"
import { useTranslations } from "next-intl"
import type { Cadence } from "@/modules/content"
import { useApplyContentCadencePresets, useSaveContentCadence } from "@/hooks/content"
import { useContentCadenceForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentChannel, ContentNoteView, ContentViews } from "@/modules/types"
import { contentSettingsError, type ContentViewInput } from "./contentWorkbench.shared"

const EMPTY_CADENCE: ReadonlyArray<Cadence> = []

/** Owns the active settings rhythm form and its two independent mutation lifetimes. */
export const useContentCadenceCardView = (input: ContentViewInput) => {
    const t = useTranslations("content")
    const form = useContentCadenceForm(input.data?.cadence ?? EMPTY_CADENCE)
    const save = useSaveContentCadence({ isActive: input.isActive && input.isReady, scope: input.scope })
    const presets = useApplyContentCadencePresets({ isActive: input.isActive && input.isReady, scope: input.scope })
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset()
        },
    })
    const rows = form.watch("rows")
    const change = (channel: ContentChannel, patch: Partial<ContentViews["cadenceRow"]>) =>
        form.setValue(
            "rows",
            form
                .getValues("rows")
                .map((row) =>
                    row.channel === channel ? { ...row, ...patch, days: [...(patch.days ?? row.days)] } : row,
                ),
        )
    const errors = form.formState.errors.rows
    const error = contentSettingsError(
        errors,
        errors?.find?.((row) => row?.time?.message)?.time?.message,
        t("err_input"),
    )
    const note: ContentNoteView | null = error ? { tone: "error", text: error } : null
    return {
        props:
            input.data === undefined
                ? undefined
                : {
                      copy: input.copy,
                      rows,
                      dayNames: t("dayShort").split(","),
                      canManage: input.data.canManage,
                      isPending: save.isPending || presets.isPending || form.formState.isSubmitting,
                      note,
                  },
        on: {
            change,
            preset: () => {
                if (input.isActive && input.isReady && input.data?.canManage === true) return presets.apply()
                return undefined
            },
            save: () => {
                if (!input.isActive || !input.isReady || input.data?.canManage !== true) return
                return form.handleSubmit((values) => {
                    save.save({
                        rows: values.rows
                            .filter((row) => row.on)
                            .map((row) => ({
                                channel: row.channel,
                                postsPerWeek: row.perWeek,
                                days: row.days,
                                time: row.time,
                            })),
                    })
                })()
            },
            dismissNote: () => form.clearErrors(),
        },
    }
}

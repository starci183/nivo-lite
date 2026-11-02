"use client"
import { useTranslations } from "next-intl"
import { useApplyContentPillarPresets, useSaveContentPillars } from "@/hooks/content"
import { useContentPillarsForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentNoteView, ContentViews, Pillar } from "@/modules/types"
import { contentSettingsError, type ContentViewInput } from "./contentWorkbench.shared"

const EMPTY_PILLARS: ReadonlyArray<Pillar> = []

/** Owns editable themes and resets only when their actual settings lifetime changes. */
export const useContentPillarsCardView = (input: ContentViewInput) => {
    const t = useTranslations("content")
    const form = useContentPillarsForm(input.data?.pillars ?? EMPTY_PILLARS)
    const save = useSaveContentPillars({ isActive: input.isActive && input.isReady, scope: input.scope })
    const presets = useApplyContentPillarPresets({ isActive: input.isActive && input.isReady, scope: input.scope })
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset()
        },
    })
    const rows = form.watch("rows")
    const errors = form.formState.errors.rows
    const error = contentSettingsError(
        errors,
        errors?.find?.((row) => row?.name?.message)?.name?.message,
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
                      canManage: input.data.canManage,
                      isPending: save.isPending || presets.isPending || form.formState.isSubmitting,
                      note,
                  },
        on: {
            change: (key: string, patch: Partial<ContentViews["pillarRow"]>) =>
                form.setValue(
                    "rows",
                    form.getValues("rows").map((row) => (row.key === key ? { ...row, ...patch } : row)),
                ),
            add: () =>
                form.setValue("rows", [
                    ...form.getValues("rows"),
                    { key: crypto.randomUUID(), name: "", description: "", weight: 1, active: true },
                ]),
            remove: (key: string) =>
                form.setValue(
                    "rows",
                    form.getValues("rows").filter((row) => row.key !== key),
                ),
            preset: () => {
                if (input.isActive && input.isReady && input.data?.canManage === true) return presets.apply()
                return undefined
            },
            save: () => {
                if (!input.isActive || !input.isReady || input.data?.canManage !== true) return
                return form.handleSubmit((values) => {
                    save.save({
                        rows: values.rows.map(({ id, name, description, weight, active }) => ({
                            id,
                            name,
                            description,
                            weight,
                            active,
                        })),
                    })
                })()
            },
            dismissNote: () => form.clearErrors(),
        },
    }
}

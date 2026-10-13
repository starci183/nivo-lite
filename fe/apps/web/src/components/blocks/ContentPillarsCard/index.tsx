"use client"

import { useTranslations } from "next-intl"
import { useApplyContentPillarPresets, useSaveContentPillars, useContentData } from "@/hooks/content"
import { useContentPillarsForm } from "@/hooks/rhf"
import { ContentPillarsCardBase } from "./component"

/** The editable theme list, with validation and GraphQL saves. */
export const ContentPillarsCard = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const form = useContentPillarsForm(data.pillars)
    const save = useSaveContentPillars()
    const presets = useApplyContentPillarPresets()
    const rows = form.watch("rows")
    const errors = form.formState.errors.rows
    const error =
        errors?.message ??
        errors?.root?.message ??
        errors?.find?.((row) => row?.name?.message)?.name?.message ??
        (errors ? t("err_input") : undefined)
    return (
        <ContentPillarsCardBase
            props={{
                t,
                rows,
                canManage: data.canManage,
                isPending: save.isMutating || presets.isMutating || form.formState.isSubmitting,
                note: error ? { tone: "error", text: error } : null,
            }}
            on={{
                change: (key, patch) =>
                    form.setValue(
                        "rows",
                        form.getValues("rows").map((row) => (row.key === key ? { ...row, ...patch } : row)),
                    ),
                add: () =>
                    form.setValue("rows", [
                        ...form.getValues("rows"),
                        { key: crypto.randomUUID(), name: "", description: "", weight: 1, active: true },
                    ]),
                remove: (key) =>
                    form.setValue(
                        "rows",
                        form.getValues("rows").filter((row) => row.key !== key),
                    ),
                preset: () => {
                    void presets.apply()
                },
                save: () => {
                    void form.handleSubmit(async (values) => {
                        await save.save({
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
            }}
        />
    )
}

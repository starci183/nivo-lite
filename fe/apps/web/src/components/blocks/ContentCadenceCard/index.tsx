"use client"

import { useTranslations } from "next-intl"
import {
    useApplyContentCadencePresets,
    useSaveContentCadence,
    type ContentChannel,
    useContentData,
} from "@/hooks/content"
import { useContentCadenceForm } from "@/hooks/rhf"
import { ContentCadenceCardBase, type CadenceRow } from "./component"

/** The workspace posting rhythm, validated locally and saved through GraphQL. */
export const ContentCadenceCard = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const form = useContentCadenceForm(data.cadence)
    const save = useSaveContentCadence()
    const presets = useApplyContentCadencePresets()
    const rows = form.watch("rows")
    const change = (channel: ContentChannel, patch: Partial<CadenceRow>) =>
        form.setValue(
            "rows",
            form
                .getValues("rows")
                .map((row) =>
                    row.channel === channel ? { ...row, ...patch, days: [...(patch.days ?? row.days)] } : row,
                ),
        )
    const errors = form.formState.errors.rows
    const error =
        errors?.message ??
        errors?.root?.message ??
        errors?.find?.((row) => row?.time?.message)?.time?.message ??
        (errors ? t("err_input") : undefined)
    return (
        <ContentCadenceCardBase
            props={{
                t,
                rows,
                dayNames: t("dayShort").split(","),
                canManage: data.canManage,
                isPending: save.isMutating || presets.isMutating || form.formState.isSubmitting,
                note: error ? { tone: "error", text: error } : null,
            }}
            on={{
                change,
                preset: () => {
                    void presets.apply()
                },
                save: () => {
                    void form.handleSubmit(async (values) => {
                        await save.save({
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
            }}
        />
    )
}

"use client"
import { useTranslations } from "next-intl"
import type { Cadence } from "@/modules/content"
import { useContentCadenceForm } from "@/hooks/rhf"
import type { ContentChannel, ContentViews, ContentWorkbenchCopy, ContentNoteView } from "@/modules/types"
import { canManageContentSettings, contentSettingsNoteOf, type ContentViewInput } from "./contentWorkbench.shared"
import { useContentCadenceCommands } from "./useContentCadenceCommands"

const EMPTY_CADENCE: ReadonlyArray<Cadence> = []

/** The view `useContentCadenceCardView` returns. */
export interface ContentCadenceCardView {
    props:
        | {
              copy: ContentWorkbenchCopy
              rows: {
                  channel: "zalo" | "facebook" | "instagram" | "tiktok"
                  label: string
                  on: boolean
                  perWeek: number
                  days: number[]
                  time: string
              }[]
              dayNames: string[]
              canManage: boolean
              isPending: boolean
              note: ContentNoteView | null
          }
        | undefined
    on: {
        change: (channel: ContentChannel, patch: Partial<ContentViews["cadenceRow"]>) => void
        preset: () =>
            | Promise<
                  | {
                        count: number
                    }
                  | undefined
              >
            | undefined
        save: () => Promise<void> | undefined
        dismissNote: () => void
    }
}

/** Owns the active settings rhythm form and its two independent mutation lifetimes. */
export const useContentCadenceCardView = (input: ContentViewInput): ContentCadenceCardView => {
    const form = useContentCadenceForm(input.data?.cadence ?? EMPTY_CADENCE)
    const { save, presets } = useContentCadenceCommands(input, form)
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
    const t = useTranslations("content")
    const note = contentSettingsNoteOf(
        errors,
        errors?.find?.((row) => row?.time?.message)?.time?.message,
        t("err_input"),
    )
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
            preset: () => (canManageContentSettings(input) ? presets.apply() : undefined),
            save: () => {
                if (!canManageContentSettings(input)) return
                return form.handleSubmit((values) =>
                    save.save({
                        rows: values.rows
                            .filter((row) => row.on)
                            .map((row) => ({
                                channel: row.channel,
                                postsPerWeek: row.perWeek,
                                days: row.days,
                                time: row.time,
                            })),
                    }),
                )()
            },
            dismissNote: () => form.clearErrors(),
        },
    }
}

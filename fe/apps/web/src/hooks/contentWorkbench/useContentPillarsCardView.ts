"use client"
import { useTranslations } from "next-intl"
import { useContentPillarsForm } from "@/hooks/rhf"
import type { ContentViews, Pillar, ContentWorkbenchCopy, ContentNoteView } from "@/modules/types"
import { canManageContentSettings, contentSettingsNoteOf, type ContentViewInput } from "./contentWorkbench.shared"
import { useContentPillarsCommands } from "./useContentPillarsCommands"

const EMPTY_PILLARS: ReadonlyArray<Pillar> = []

/** The view `useContentPillarsCardView` returns. */
export interface ContentPillarsCardView {
    props:
        | {
              copy: ContentWorkbenchCopy
              rows: {
                  key: string
                  name: string
                  description: string
                  weight: number
                  active: boolean
                  id?: string | undefined
              }[]
              canManage: boolean
              isPending: boolean
              note: ContentNoteView | null
          }
        | undefined
    on: {
        change: (key: string, patch: Partial<ContentViews["pillarRow"]>) => void
        add: () => void
        remove: (key: string) => void
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

/** Owns editable themes and resets only when their actual settings lifetime changes. */
export const useContentPillarsCardView = (input: ContentViewInput): ContentPillarsCardView => {
    const form = useContentPillarsForm(input.data?.pillars ?? EMPTY_PILLARS)
    const { save, presets } = useContentPillarsCommands(input, form)
    const rows = form.watch("rows")
    const errors = form.formState.errors.rows
    const t = useTranslations("content")
    const note = contentSettingsNoteOf(
        errors,
        errors?.find?.((row) => row?.name?.message)?.name?.message,
        t("err_input"),
    )
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
            preset: () => (canManageContentSettings(input) ? presets.apply() : undefined),
            save: () => {
                if (!canManageContentSettings(input)) return
                return form.handleSubmit((values) =>
                    save.save({
                        rows: values.rows.map(({ id, name, description, weight, active }) => ({
                            id,
                            name,
                            description,
                            weight,
                            active,
                        })),
                    }),
                )()
            },
            dismissNote: () => form.clearErrors(),
        },
    }
}

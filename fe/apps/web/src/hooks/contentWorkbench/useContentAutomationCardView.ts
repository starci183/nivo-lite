"use client"
import { useTranslations } from "next-intl"
import { useSetContentAutomation } from "@/hooks/content"
import { useContentAutomationForm } from "@/hooks/rhf"
import { defaultSettings } from "@/modules/content"
import { useMemo } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import type { ContentNoteView, ContentViews, ContentWorkbenchCopy, AutomationKey } from "@/modules/types"
import type { ContentViewInput } from "./contentWorkbench.shared"

const COPY: ReadonlyArray<{
    key: ContentViews["automationKey"]
    title: "autoReminder" | "autoOffer" | "autoSummary"
    body: "autoReminderBody" | "autoOfferBody" | "autoSummaryBody"
}> = [
    { key: "today_reminder", title: "autoReminder", body: "autoReminderBody" },
    { key: "offer_draft", title: "autoOffer", body: "autoOfferBody" },
    { key: "weekly_summary", title: "autoSummary", body: "autoSummaryBody" },
]

/** The view `useContentAutomationCardView` returns. */
export interface ContentAutomationCardView {
    props:
        | {
              copy: ContentWorkbenchCopy
              rows: {
                  key: AutomationKey
                  title: string
                  body: string
                  on: boolean
              }[]
              canManage: boolean
              isPending: boolean
              note: null
          }
        | undefined
    on: {
        toggle: (keyInput: string, value: boolean) => Promise<void> | undefined
        dismissNote: () => void
    }
}

/** Owns optimistic automation edits; stale completions cannot revert a replacement settings form. */
export const useContentAutomationCardView = (input: ContentViewInput): ContentAutomationCardView => {
    const t = useTranslations("content")
    const defaults = useMemo(() => defaultSettings(input.workspaceId ?? ""), [input.workspaceId])
    const form = useContentAutomationForm(input.data?.settings ?? defaults)
    const mutation = useSetContentAutomation({ isActive: input.isActive && input.isReady, scope: input.scope })
    const lifetime = useFeatureLifetime(input.isActive && input.isReady, input.scope)
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset()
        },
    })
    const values = form.watch()
    const toggle = (keyInput: string, value: boolean) => {
        if (!input.isActive || !input.isReady || input.data?.canManage !== true) return
        const key = COPY.find((row) => row.key === keyInput)?.key
        if (key === undefined) return
        const isCurrent = lifetime.capture()
        const previous = form.getValues(key)
        form.setValue(key, value)
        return form.handleSubmit((request) =>
            mutation.set({ key, on: request[key] }, (saved) => {
                if (isCurrent() && saved === undefined) form.setValue(key, previous)
            }),
        )()
    }
    const note: ContentNoteView | null = null
    return {
        props:
            input.data === undefined
                ? undefined
                : {
                      copy: input.copy,
                      rows: COPY.map((row) => ({
                          key: row.key,
                          title: t(row.title),
                          body: t(row.body),
                          on: values[row.key],
                      })),
                      canManage: input.data.canManage,
                      isPending: mutation.isPending || form.formState.isSubmitting,
                      note,
                  },
        on: { toggle, dismissNote: () => form.clearErrors() },
    }
}

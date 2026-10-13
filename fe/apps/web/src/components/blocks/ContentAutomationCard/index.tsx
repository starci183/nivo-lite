"use client"

import { useTranslations } from "next-intl"
import { useSetContentAutomation, useContentData } from "@/hooks/content"
import { useContentAutomationForm } from "@/hooks/rhf"
import { ContentAutomationCardBase } from "./component"

const COPY = [
    { key: "today_reminder", title: "autoReminder", body: "autoReminderBody" },
    { key: "offer_draft", title: "autoOffer", body: "autoOfferBody" },
    { key: "weekly_summary", title: "autoSummary", body: "autoSummaryBody" },
] as const

/** The automation switches, with an optimistic value reverted when GraphQL rejects a change. */
export const ContentAutomationCard = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const form = useContentAutomationForm(data.settings)
    const { set, isMutating } = useSetContentAutomation()
    const values = form.watch()
    const toggle = (input: string, value: boolean) => {
        const key = COPY.find((row) => row.key === input)?.key
        if (key === undefined) return
        const previous = form.getValues(key)
        form.setValue(key, value)
        void form.handleSubmit(async (request) => {
            const saved = await set({ key, on: request[key] })
            if (saved === undefined) form.setValue(key, previous)
        })()
    }
    return (
        <ContentAutomationCardBase
            props={{
                t,
                rows: COPY.map((row) => ({
                    key: row.key,
                    title: t(row.title),
                    body: t(row.body),
                    on: values[row.key],
                })),
                canManage: data.canManage,
                isPending: isMutating || form.formState.isSubmitting,
                note: null,
            }}
            on={{ toggle, dismissNote: () => form.clearErrors() }}
        />
    )
}

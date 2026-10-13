"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useContentCommand, type ContentSettings } from "@/hooks/content"
import { writeSetAutomation } from "@/modules/db/content-settings/write-settings"
import { ContentAutomationCardBase } from "./component"

/** Props of {@link ContentAutomationCard}. */
export interface ContentAutomationCardProps {
    /** The saved settings. */
    readonly settings: ContentSettings
    /** Whether the member may change them. */
    readonly canManage: boolean
}

const COPY = [
    { key: "today_reminder", title: "autoReminder", body: "autoReminderBody" },
    { key: "offer_draft", title: "autoOffer", body: "autoOfferBody" },
    { key: "weekly_summary", title: "autoSummary", body: "autoSummaryBody" },
] as const

/** The automations of the content module: switch each one on or off. */
export const ContentAutomationCard = (props: ContentAutomationCardProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const [on, setOn] = useState(props.settings.automations)
    const toggle = (key: string, value: boolean) => {
        const previous = on
        setOn({ ...on, [key]: value })
        command.run(
            "automation",
            async () => {
                const done = await writeSetAutomation(key, value)
                if (done.kind !== "ok") setOn(previous)
                return done
            },
            () => command.say("ok", t("saveDone")),
        )
    }
    return (
        <ContentAutomationCardBase
            props={{
                t,
                rows: COPY.map((c) => ({ key: c.key, title: t(c.title), body: t(c.body), on: on[c.key] })),
                canManage: props.canManage,
                isPending: command.isPending,
                note: command.note,
            }}
            on={{ toggle, dismissNote: command.dismiss }}
        />
    )
}

"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    channelLabel,
    CONTENT_CHANNELS,
    toInstant,
    useContentCommand,
    useContentFocus,
    useContentItemActions,
    useContentData,
} from "@/hooks/content"
import { useContentAddPostForm } from "@/hooks/rhf"
import { ContentAddPostBase } from "./component"

/** "Add a post": a manual idea with an optional date, theme and channels, then opened in the editor. */
export const ContentAddPost = () => {
    const data = useContentData()
    const pillars = data.pillars.filter((pillar) => pillar.active)
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const actions = useContentItemActions()
    const form = useContentAddPostForm()
    const [isOpen, setOpen] = useState(false)
    const { title, date, time, pillarId, channels } = form.watch()
    const run = form.handleSubmit(
        (values) => {
            const at = toInstant(values.date, values.time, "19:30")
            if (at === "date_invalid" || at === "time_invalid") {
                command.say("error", t(at === "date_invalid" ? "dateInvalid" : "timeInvalid"))
                return
            }
            command.run(
                "add",
                () =>
                    actions.create({
                        title: values.title,
                        scheduledAt: at,
                        channels: values.channels,
                        pillarId: values.pillarId,
                    }),
                (done) => {
                    if (done.kind !== "ok") return
                    setOpen(false)
                    form.reset()
                    if ("value" in done) focus.open(done.value.id)
                },
            )
        },
        (errors) => {
            const message = Object.values(errors).find((error) => error?.message)?.message
            if (message) command.say("error", message)
        },
    )
    return (
        <ContentAddPostBase
            props={{
                t,
                isOpen,
                title,
                date,
                time,
                pillarId,
                channels,
                channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: channelLabel(t, rule.key) })),
                pillarOptions: [{ id: "", label: t("noPillar") }, ...pillars.map((p) => ({ id: p.id, label: p.name }))],
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                openChange: (open) => {
                    if (!open && !command.isPending) setOpen(false)
                },
                title: (value) => form.setValue("title", value),
                date: (value) => form.setValue("date", value),
                time: (value) => form.setValue("time", value),
                pillar: (value) => form.setValue("pillarId", value || null),
                channels: (values) =>
                    form.setValue(
                        "channels",
                        CONTENT_CHANNELS.filter((c) => values.includes(c)),
                    ),
                run: () => {
                    void run()
                },
                dismissNote: command.dismiss,
            }}
        />
    )
}

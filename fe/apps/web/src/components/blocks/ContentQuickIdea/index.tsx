"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    CONTENT_CHANNELS,
    useContentFocus,
    useRequestContentQuickDraft,
    useContentData,
} from "@/hooks/content"
import { useContentQuickIdeaForm } from "@/hooks/rhf"
import { ContentQuickIdeaBase } from "./component"

/** "Quick idea": paste a topic, choose channels, get a draft per channel and open it in the editor. */
export const ContentQuickIdea = () => {
    const data = useContentData()
    const defaultChannels = data.cadence.filter((entry) => entry.posts_per_week > 0).map((entry) => entry.channel)
    const t = useTranslations("content")
    const focus = useContentFocus()
    const [isOpen, setOpen] = useState(false)
    const form = useContentQuickIdeaForm(defaultChannels)
    const job = useRequestContentQuickDraft((status) => {
        const itemId = status.itemId ?? status.resultId
        if (!itemId) return
        setOpen(false)
        form.reset()
        focus.open(itemId)
    })
    const run = form.handleSubmit(async (values) => {
        await job.request(values)
    })
    const error = form.formState.errors.topic?.message ?? form.formState.errors.channels?.message
    return (
        <ContentQuickIdeaBase
            props={{
                t,
                isOpen,
                topic: form.watch("topic"),
                channels: form.watch("channels"),
                channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: rule.label })),
                isPending: form.formState.isSubmitting || job.isPending,
                note: error ? { tone: "error", text: error } : null,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                topic: (topic) => form.setValue("topic", topic, { shouldValidate: form.formState.isSubmitted }),
                channels: (values) =>
                    form.setValue(
                        "channels",
                        CONTENT_CHANNELS.filter((c) => values.includes(c)),
                        {
                            shouldValidate: form.formState.isSubmitted,
                        },
                    ),
                run: () => void run(),
                dismissNote: () => form.clearErrors(),
            }}
        />
    )
}

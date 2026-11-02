"use client"
import type { ContentViews, ContentActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    channelLabel,
    CONTENT_CHANNELS,
    useContentFocus,
    useRequestContentQuickDraft,
} from "@/hooks/content"
import { useContentQuickIdeaForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** Owns the actual ContentQuickIdea data derivations and conditional controller lifetime. */
export const useContentQuickIdeaView = (input: ContentViewInput) => {
    const data = input.data
    const defaultChannels =
        data?.cadence.filter((entry) => entry.posts_per_week > 0).map((entry) => entry.channel) ?? []
    const t = useTranslations("content")
    const focus = useContentFocus()
    const [isOpen, setOpen] = useState(false)
    const form = useContentQuickIdeaForm(defaultChannels)
    const job = useRequestContentQuickDraft(
        (status) => {
            const itemId = status.itemId ?? status.resultId
            if (!itemId) return
            setOpen(false)
            form.reset()
            focus.open(itemId)
        },
        input.isActive && input.isReady,
        input.scope,
    )
    const run = form.handleSubmit((values) => {
        job.request(values)
    })
    const error = form.formState.errors.topic?.message ?? form.formState.errors.channels?.message
    const isPending = form.formState.isSubmitting || job.isPending

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset({ topic: "", channels: defaultChannels.length > 0 ? [...defaultChannels] : ["facebook"] })
            setOpen(false)
        },
    })

    const props: ContentViews["quickIdeaFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
                  isOpen,
                  topic: form.watch("topic"),
                  channels: form.watch("channels"),
                  channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: channelLabel(t, rule.key) })),
                  isPending,
                  note: error ? { tone: "error", text: error } : null,
              }
    const on: ContentActions["quickIdeaActions"] = {
        open: () => {
            if (input.isActive && input.isReady) setOpen(true)
        },
        close: () => setOpen(false),
        openChange: (open) => {
            if (!open && !isPending) setOpen(false)
        },
        topic: (topic) => form.setValue("topic", topic, { shouldValidate: form.formState.isSubmitted }),
        channels: (values) =>
            form.setValue(
                "channels",
                CONTENT_CHANNELS.filter((c) => values.includes(c)),
                {
                    shouldValidate: form.formState.isSubmitted,
                },
            ),
        run: () => run(),
        dismissNote: () => form.clearErrors(),
    }
    return { props, on }
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CONTENT_CHANNELS, type ContentChannel } from "@/modules/content"
import type { UseFormReturn } from "react-hook-form"

type UseContentQuickIdeaFormResult = UseFormReturn<{
    topic: string
    channels: ("facebook" | "zalo" | "tiktok" | "instagram")[]
}>

/** Validates a quick topic and its requested channels before queuing the draft. */
export const useContentQuickIdeaForm = (
    defaultChannels: ReadonlyArray<ContentChannel>,
): UseContentQuickIdeaFormResult => {
    const t = useTranslations("content")
    const schema = useMemo(
        () =>
            z.object({
                topic: z.string().trim().min(3, t("err_topic_short")).max(12000, t("err_input")),
                channels: z.array(z.enum(CONTENT_CHANNELS)).min(1, t("err_channels_required")).max(4, t("err_input")),
            }),
        [t],
    )
    return useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { topic: "", channels: defaultChannels.length > 0 ? [...defaultChannels] : ["facebook"] },
    })
}

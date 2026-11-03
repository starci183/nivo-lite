"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toInstant } from "@/modules/content"
import type { ContentChannel } from "@/modules/content"
import type { UseFormReturn } from "react-hook-form"

const NO_PILLAR: string | null = null
const DEFAULT_CHANNELS: Array<ContentChannel> = ["facebook"]

type UseContentAddPostFormResult = UseFormReturn<
    {
        title: string
        date: string
        time: string
        pillarId: string | null
        channels: ("facebook" | "zalo" | "tiktok" | "instagram")[]
    },
    unknown,
    {
        title: string
        date: string
        time: string
        pillarId: string | null
        channels: ("facebook" | "zalo" | "tiktok" | "instagram")[]
    }
>

/** Validates the manually entered post using localized form messages. */
export const useContentAddPostForm = (): UseContentAddPostFormResult => {
    const t = useTranslations("content")
    const schema = z
        .object({
            title: z.string().trim().min(1, t("err_title_required")).max(200, t("err_input")),
            date: z.string(),
            time: z.string(),
            pillarId: z.string().nullable(),
            channels: z.array(z.enum(["facebook", "zalo", "tiktok", "instagram"])).min(1, t("err_channels_required")),
        })
        .superRefine((values, context) => {
            const at = toInstant(values.date, values.time, "19:30")
            if (at === "date_invalid") context.addIssue({ code: "custom", path: ["date"], message: t("dateInvalid") })
            if (at === "time_invalid") context.addIssue({ code: "custom", path: ["time"], message: t("timeInvalid") })
        })
    return useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            title: "",
            date: "",
            time: "19:30",
            pillarId: NO_PILLAR,
            channels: DEFAULT_CHANNELS,
        },
    })
}

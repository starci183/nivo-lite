"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { MUSIC_TRACKS, TTS_VOICES } from "@/modules/video"
import type { Brand } from "@/modules/video"

/** Validates the brand kit with localized messages before it is saved. */
export const useVideoBrandForm = (initial: Brand) => {
    const t = useTranslations("video")
    const schema = useMemo(() => {
        const error = t("err_default")
        const color = z
            .string({ error })
            .trim()
            .regex(/^#[0-9a-f]{6}$/i, error)
        return z.object({
            shopName: z.string({ error }).trim().max(60, error),
            primary: color,
            secondary: color,
            logoPath: z.string({ error }).min(1, error).max(300, error).nullable(),
            musicTrack: z
                .string({ error })
                .refine((value) => MUSIC_TRACKS.some((track) => track.id === value), error)
                .nullable(),
            voice: z.string({ error }).refine((value) => TTS_VOICES.some((voice) => voice === value), error),
        })
    }, [t])
    return useForm<Brand>({
        resolver: zodResolver(schema),
        defaultValues: initial,
        mode: "onSubmit",
    })
}

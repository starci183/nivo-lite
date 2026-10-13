"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SCRIPT_MAX_SCENES } from "@/modules/video"
import type { ScriptScene } from "@/modules/video"

/** The scenes edited before rendering a video. */
export interface VideoScriptValues {
    /** The ordered scenes in the script. */
    scenes: Array<ScriptScene>
}

/** Validates edited scenes with localized messages before they are saved or rendered. */
export const useVideoScriptForm = (initial: ReadonlyArray<ScriptScene>) => {
    const t = useTranslations("video")
    const schema = useMemo(() => {
        const error = t("err_default")
        const scene = z.object({
            id: z.string({ error }).min(1, error).max(60, error),
            role: z.enum(["hook", "body", "cta"], { error }),
            caption: z.string({ error }).max(160, error),
            voiceover: z.string({ error }).max(420, error),
            visual: z.string({ error }).max(240, error),
            media: z.string({ error }).min(1, error).max(300, error).nullable(),
        })
        return z.object({ scenes: z.array(scene, { error }).max(SCRIPT_MAX_SCENES, error) })
    }, [t])
    return useForm<VideoScriptValues>({
        resolver: zodResolver(schema),
        defaultValues: { scenes: initial.map((scene) => ({ ...scene })) },
        mode: "onSubmit",
    })
}

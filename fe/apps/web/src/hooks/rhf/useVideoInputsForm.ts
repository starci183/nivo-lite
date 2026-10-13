"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { ProjectInputs } from "@/modules/video"

/** The editable sources, notes and media used by the script writer. */
export interface VideoInputsValues {
    /** The selected knowledge sources. */
    sourceIds: Array<string>
    /** The owner's additional brief. */
    notes: string
    /** Uploaded paths offered to the script. */
    media: Array<string>
    /** Whether automation created these inputs. */
    auto: boolean
}

/** Validates the material step with localized messages before it is saved. */
export const useVideoInputsForm = (initial: ProjectInputs) => {
    const t = useTranslations("video")
    const schema = useMemo(() => {
        const error = t("err_default")
        return z.object({
            sourceIds: z.array(z.uuid({ error }), { error }).max(12, error),
            notes: z.string({ error }).max(600, error),
            media: z.array(z.string({ error }).min(1, error).max(300, error), { error }).max(40, error),
            auto: z.boolean({ error }),
        })
    }, [t])
    return useForm<VideoInputsValues>({
        resolver: zodResolver(schema),
        defaultValues: { ...initial, sourceIds: [...initial.sourceIds], media: [...initial.media] },
        mode: "onSubmit",
    })
}

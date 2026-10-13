"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ASPECTS, TARGET_SECONDS_MAX, TARGET_SECONDS_MIN } from "@/modules/video"
import type { Aspect, Goal } from "@/modules/video"

/** The choices that create or update a video's goal. */
export interface VideoGoalValues {
    /** The purpose of the video. */
    goal: Goal
    /** The output frame shape. */
    aspect: Aspect
    /** The target length in seconds. */
    seconds: number
    /** The working title; empty lets the back end choose it. */
    title: string
}

/** Validates the goal step with localized messages before its GraphQL mutation runs. */
export const useVideoGoalForm = (initial: VideoGoalValues) => {
    const t = useTranslations("video")
    const schema = useMemo(() => {
        const error = t("err_default")
        return z.object({
            goal: z.enum(["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"], { error }),
            aspect: z.enum(ASPECTS, { error }),
            seconds: z.number({ error }).int(error).min(TARGET_SECONDS_MIN, error).max(TARGET_SECONDS_MAX, error),
            title: z.string({ error }).trim().max(120, error),
        })
    }, [t])
    return useForm<VideoGoalValues>({
        resolver: zodResolver(schema),
        defaultValues: initial,
        mode: "onSubmit",
    })
}

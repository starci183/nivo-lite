"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { JOB_TITLE_MIN, jobDefaults } from "@/hooks/hiringJobs"
import type { HiringJobValues } from "@/hooks/hiringJobs"
import type { JobView } from "@/hooks/hiringWire"

/**
 * The job editor form: a zod schema whose message comes from the `hiring` catalog, validated as the owner types. The values follow
 * the job being edited (null: a new one), so the one mounted form serves every job the editor opens for.
 */
export const useHiringJobForm = (job: JobView | null) => {
    const t = useTranslations("hiring")
    const defaults = useMemo(
        () => jobDefaults(job, [t("starterQuestionExperience"), t("starterQuestionStart")]),
        [job, t],
    )
    const schema = useMemo(
        () =>
            z.object({
                title: z.string().trim().min(JOB_TITLE_MIN, t("jobTitleHint")),
                position: z.string(),
                employmentType: z.string(),
                schedule: z.string(),
                payMin: z.number().nullable(),
                payMax: z.number().nullable(),
                payUnit: z.string(),
                location: z.string(),
                headcount: z.number().int().min(1).max(500),
                description: z.string().max(6000),
                skills: z.string(),
                years: z.number().nullable(),
                experienceNote: z.string(),
                availability: z.string(),
                mustHave: z.string(),
                niceToHave: z.string(),
                questions: z.array(
                    z.object({
                        id: z.string(),
                        text: z.string(),
                        type: z.string(),
                        required: z.boolean(),
                        choices: z.string(),
                        expect: z.string(),
                    }),
                ),
                channels: z.array(z.string()),
            }),
        [t],
    )
    return useForm<HiringJobValues>({ resolver: zodResolver(schema), values: defaults, mode: "onChange" })
}

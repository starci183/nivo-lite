"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "@/hooks/hiringSettings"
import type { SettingsValues } from "@/hooks/hiringSettings"

const schema = z.object({
    publicSlug: z.string(),
    retentionDays: z.number().int().min(RETENTION_MIN_DAYS).max(RETENTION_MAX_DAYS),
    applyConsentText: z.string().max(800),
    adTone: z.string(),
    notifyNewCandidate: z.boolean(),
    remindInterview: z.boolean(),
    autoCloseWhenFilled: z.boolean(),
})

/** The settings form: the public link name, how long closed files are kept, the consent text, the tone and the three switches. */
export const useHiringSettingsForm = (defaults: SettingsValues) =>
    useForm<SettingsValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: "onChange" })

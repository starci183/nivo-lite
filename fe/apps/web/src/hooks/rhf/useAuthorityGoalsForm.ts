"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { AuthorityProfile } from "@/hooks/authority"

/** The values of the goals form: the three targets (empty when none) and the note. */
export interface AuthorityGoalsValues {
    goalRevenue: number | null
    goalCustomers: number | null
    goalReply: number | null
    goalNote: string
}

/** The goals form over the stored profile: whole numbers only, the note trimmed; the stored values refill it when they change. */
export const useAuthorityGoalsForm = (profile: AuthorityProfile) => {
    const t = useTranslations("authority")
    const schema = useMemo(
        () =>
            z.object({
                goalRevenue: z.number().int(t("errNumber")).min(0, t("errNumber")).nullable(),
                goalCustomers: z.number().int(t("errNumber")).min(0, t("errNumber")).nullable(),
                goalReply: z.number().int(t("errNumber")).min(1, t("errNumber")).nullable(),
                goalNote: z.string().trim(),
            }),
        [t],
    )
    const values = useMemo<AuthorityGoalsValues>(
        () => ({
            goalRevenue: profile.goalRevenue,
            goalCustomers: profile.goalCustomers,
            goalReply: profile.goalReply,
            goalNote: profile.goalNote,
        }),
        [profile],
    )
    return useForm<AuthorityGoalsValues>({ resolver: zodResolver(schema), values, mode: "onSubmit" })
}

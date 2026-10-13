"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN } from "@/hooks/auth"
import { NO_STAFF } from "@/hooks/team"

/** The values of the invite form. */
export interface InviteValues {
    email: string
    role: "manager" | "staff"
    /** The staff row the account will be, or {@link NO_STAFF}. */
    staffId: string
}

/** The longest address the form accepts. */
const EMAIL_MAX = 254

/** The invite form: a zod schema whose messages come from the `team` catalog, validated before the mutation runs. */
export const useInviteForm = () => {
    const t = useTranslations("team")
    const schema = useMemo(
        () =>
            z.object({
                email: z.string().trim().max(EMAIL_MAX, t("errEmail")).regex(EMAIL_PATTERN, t("errEmail")),
                role: z.enum(["manager", "staff"]),
                staffId: z.string(),
            }),
        [t],
    )
    return useForm<InviteValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: "", role: "staff", staffId: NO_STAFF },
        mode: "onSubmit",
    })
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { LOYALTY_MEMBER_NAME_MAX, LOYALTY_MEMBER_NOTE_MAX, inputToIso } from "@/hooks/loyalty"

/** The values of the loyalty member details form; the birthday is typed as day/month/year. */
export interface LoyaltyMemberValues {
    name: string
    birthday: string
    note: string
}

/** The member details form: a zod schema whose messages come from the `loyalty` catalog; `initial` is the saved member it starts from. */
export const useLoyaltyMemberForm = (initial: LoyaltyMemberValues) => {
    const t = useTranslations("loyalty")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, t("nameRequired")).max(LOYALTY_MEMBER_NAME_MAX, t("nameRequired")),
                birthday: z.string().refine((value) => inputToIso(value) !== undefined, t("birthdayInvalid")),
                note: z.string().trim().max(LOYALTY_MEMBER_NOTE_MAX),
            }),
        [t],
    )
    return useForm<LoyaltyMemberValues>({
        resolver: zodResolver(schema),
        values: initial,
        resetOptions: { keepDirtyValues: true },
        mode: "onChange",
    })
}

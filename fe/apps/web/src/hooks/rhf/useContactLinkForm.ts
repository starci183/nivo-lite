"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { EMAIL_PATTERN } from "@/hooks/auth"
import { INPUT_BOUNDS } from "@/modules/api"

/** The identity kinds a person can link by hand: a phone or an e-mail (a channel id is the channel's to give). */
export type ContactLinkKind = "phone" | "email"

/** The values of the link form. */
export interface ContactLinkValues {
    kind: ContactLinkKind
    value: string
}

/** What the contract allows an identity's value. */
const VALUE_MAX = INPUT_BOUNDS.LinkContactIdentityInput.value.maxLength

/** A phone as a person types it: digits, with an optional plus and the usual spaces, dots and dashes between them. */
const PHONE_PATTERN = /^\+?[\d\s.-]{8,20}$/u

/** The link form: a phone or an e-mail, checked by its kind before the mutation runs. */
export const useContactLinkForm = (): UseFormReturn<ContactLinkValues> => {
    const t = useTranslations("contacts")
    const schema = useMemo(
        () =>
            z
                .object({
                    kind: z.enum(["phone", "email"]),
                    value: z.string().trim().max(VALUE_MAX, t("errLinkValue")),
                })
                .refine((form) => (form.kind === "phone" ? PHONE_PATTERN : EMAIL_PATTERN).test(form.value), {
                    message: t("errLinkValue"),
                    path: ["value"],
                }),
        [t],
    )
    return useForm<ContactLinkValues>({
        resolver: zodResolver(schema),
        defaultValues: { kind: "phone", value: "" },
        mode: "onSubmit",
    })
}

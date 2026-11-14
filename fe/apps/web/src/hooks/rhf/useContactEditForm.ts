"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { INPUT_BOUNDS } from "@/modules/api"
import { tagsOfText } from "@/modules/contacts"

/** The values of the contact edit form: the name, and the tags as one line separated by commas. */
export interface ContactEditValues {
    name: string
    tags: string
}

/** What the contract allows a contact's name and tags (read from the generated bounds, never copied). */
const BOUNDS = INPUT_BOUNDS.UpdateContactInput

/** The contact edit form: a zod schema whose messages come from the `contacts` catalog; `values` is what the person has now. */
export const useContactEditForm = (values: ContactEditValues): UseFormReturn<ContactEditValues> => {
    const t = useTranslations("contacts")
    const schema = useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .trim()
                    .max(BOUNDS.displayName.maxLength, t("errName", { max: BOUNDS.displayName.maxLength })),
                tags: z.string().superRefine((text, context) => {
                    const tags = tagsOfText(text)
                    const longest = tags.reduce((most, tag) => Math.max(most, tag.length), 0)
                    if (tags.length > BOUNDS.tags.maxItems || longest > BOUNDS.tags.itemMaxLength) {
                        context.addIssue({
                            code: "custom",
                            message: t("errTags", { maxItems: BOUNDS.tags.maxItems, max: BOUNDS.tags.itemMaxLength }),
                        })
                    }
                }),
            }),
        [t],
    )
    return useForm<ContactEditValues>({
        resolver: zodResolver(schema),
        values,
        resetOptions: { keepDirtyValues: true },
        mode: "onSubmit",
    })
}

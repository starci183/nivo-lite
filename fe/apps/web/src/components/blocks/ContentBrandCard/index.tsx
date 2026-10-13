"use client"

import { useTranslations } from "next-intl"
import { useSaveContentBrand, useContentData } from "@/hooks/content"
import { useContentBrandForm } from "@/hooks/rhf"
import { ContentBrandCardBase } from "./component"

/** The brand voice form, saved through the workspace GraphQL mutation. */
export const ContentBrandCard = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const form = useContentBrandForm(data.settings)
    const { save, isMutating } = useSaveContentBrand()
    const values = form.watch()
    const error = Object.values(form.formState.errors).find((field) => field?.message)?.message
    return (
        <ContentBrandCardBase
            props={{
                t,
                voice: values.brandVoice,
                avoid: values.avoid,
                cta: values.cta,
                tags: values.hashtags,
                canManage: data.canManage,
                isPending: isMutating || form.formState.isSubmitting,
                note: error ? { tone: "error", text: error } : null,
            }}
            on={{
                voice: (value) => form.setValue("brandVoice", value),
                avoid: (value) => form.setValue("avoid", value),
                cta: (value) => form.setValue("cta", value),
                tags: (value) => form.setValue("hashtags", value),
                save: () => {
                    void form.handleSubmit(async (request) => {
                        await save(request)
                    })()
                },
                dismissNote: () => form.clearErrors(),
            }}
        />
    )
}

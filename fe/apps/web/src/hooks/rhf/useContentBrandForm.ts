"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { ContentSettings } from "@/modules/content"
import type { UseFormReturn } from "react-hook-form"

type ContentBrandT = ReturnType<typeof useTranslations<"content">>
type BrandSchemaResult = z.ZodObject<
    {
        brandVoice: z.ZodString
        avoid: z.ZodString
        cta: z.ZodString
        hashtags: z.ZodString
    },
    z.core.$strip
>

const brandSchema = (t: ContentBrandT): BrandSchemaResult =>
    z.object({
        brandVoice: z.string().trim().max(1500, t("err_input")),
        avoid: z.string().trim().max(1500, t("err_input")),
        cta: z.string().trim().max(300, t("err_input")),
        hashtags: z.string().trim().max(4000, t("err_input")),
    })

/** Local editable brand fields, validated before saving. */
export type ContentBrandValues = z.infer<ReturnType<typeof brandSchema>>

type UseContentBrandFormResult = UseFormReturn<{
    brandVoice: string
    avoid: string
    cta: string
    hashtags: string
}>

/** Validates the brand voice and resets it when fresh saved settings arrive. */
export const useContentBrandForm = (initial: ContentSettings): UseContentBrandFormResult => {
    const t = useTranslations("content")
    const schema = useMemo(() => brandSchema(t), [t])
    const values = useMemo(
        () => ({
            brandVoice: initial.brand_voice,
            avoid: initial.avoid,
            cta: initial.cta,
            hashtags: initial.hashtags.join(" "),
        }),
        [initial],
    )
    const form = useForm<ContentBrandValues>({
        resolver: zodResolver(schema),
        defaultValues: values,
        mode: "onSubmit",
    })
    const { reset } = form
    useEffect(() => reset(values), [reset, values])
    return form
}

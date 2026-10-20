"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { isColorList, isLineList, type BrandKitText } from "@/modules/content"

type MarketingT = ReturnType<typeof useTranslations<"marketing">>

const brandKitSchema = (t: MarketingT) =>
    z.object({
        brandName: z.string().trim().min(1, t("err_brandName")).max(80, t("err_brandName")),
        colors: z.string().refine(isColorList, t("err_colors")),
        fonts: z.string().refine((text) => isLineList(text, 4, 60), t("err_list")),
        tone: z.string().trim().max(400, t("err_list")),
        address: z.string().trim().max(200, t("err_list")),
        imagery: z.string().refine((text) => isLineList(text, 5, 120), t("err_list")),
        avoid: z.string().refine((text) => isLineList(text, 10, 120), t("err_list")),
    })

/** Validates the owner's edit of a brand proposal (one item per line for the lists) before it is confirmed. */
export const useBrandKitForm = (initial: BrandKitText) => {
    const t = useTranslations("marketing")
    const schema = useMemo(() => brandKitSchema(t), [t])
    return useForm<BrandKitText>({ resolver: zodResolver(schema), defaultValues: initial, mode: "onSubmit" })
}

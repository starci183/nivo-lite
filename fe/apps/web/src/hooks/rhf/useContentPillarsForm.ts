"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { Pillar } from "@/modules/content"

type ContentPillarsT = ReturnType<typeof useTranslations<"content">>
const pillarsSchema = (t: ContentPillarsT) =>
    z.object({
        rows: z
            .array(
                z.object({
                    key: z.string(),
                    id: z.uuid(t("err_input")).optional(),
                    name: z.string().trim().min(1, t("err_input")).max(80, t("err_input")),
                    description: z.string().trim().max(300, t("err_input")),
                    weight: z.number().int(t("err_input")).min(0, t("err_input")).max(20, t("err_input")),
                    active: z.boolean(),
                }),
            )
            .max(100, t("err_input"))
            .refine((rows) => {
                const names = rows.map((row) => row.name.toLowerCase())
                return new Set(names).size === names.length
            }, t("err_pillar_duplicate")),
    })

/** Local editable theme rows, including a stable key for unsaved themes. */
export type ContentPillarsValues = z.infer<ReturnType<typeof pillarsSchema>>

/** Checks theme fields and duplicate names before saving. */
export const useContentPillarsForm = (initial: ReadonlyArray<Pillar>) => {
    const t = useTranslations("content")
    const schema = useMemo(() => pillarsSchema(t), [t])
    const values = useMemo(
        () => ({
            rows: initial.map((row) => ({
                key: row.id,
                id: row.id,
                name: row.name,
                description: row.description,
                weight: row.weight,
                active: row.active,
            })),
        }),
        [initial],
    )
    const form = useForm<ContentPillarsValues>({
        resolver: zodResolver(schema),
        defaultValues: values,
        mode: "onSubmit",
    })
    const { reset } = form
    useEffect(() => reset(values), [reset, values])
    return form
}

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CHANNEL_RULES, type Cadence } from "@/modules/content"

type ContentCadenceT = ReturnType<typeof useTranslations<"content">>
const cadenceSchema = (t: ContentCadenceT) =>
    z.object({
        rows: z
            .array(
                z.object({
                    channel: z.enum(["facebook", "zalo", "tiktok", "instagram"]),
                    label: z.string(),
                    on: z.boolean(),
                    perWeek: z.number().int(t("err_input")).min(1, t("err_input")).max(21, t("err_input")),
                    days: z
                        .array(z.number().int(t("err_input")).min(1, t("err_input")).max(7, t("err_input")))
                        .max(7, t("err_input")),
                    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t("err_time_invalid")),
                }),
            )
            .max(4, t("err_input")),
    })

/** Local editable posting rhythm rows. */
export type ContentCadenceValues = z.infer<ReturnType<typeof cadenceSchema>>

/** Validates weekday, frequency and time fields before saving the posting rhythm. */
export const useContentCadenceForm = (initial: ReadonlyArray<Cadence>) => {
    const t = useTranslations("content")
    const schema = useMemo(() => cadenceSchema(t), [t])
    const values = useMemo(
        () => ({
            rows: CHANNEL_RULES.map((rule) => {
                const saved = initial.find((row) => row.channel === rule.key)
                return {
                    channel: rule.key,
                    label: rule.label,
                    on: saved !== undefined && saved.posts_per_week > 0,
                    perWeek: saved && saved.posts_per_week > 0 ? saved.posts_per_week : 3,
                    days: [...(saved?.days ?? [])],
                    time: saved?.post_time ?? "19:30",
                }
            }),
        }),
        [initial],
    )
    const form = useForm<ContentCadenceValues>({
        resolver: zodResolver(schema),
        defaultValues: values,
        mode: "onSubmit",
    })
    const { reset } = form
    useEffect(() => reset(values), [reset, values])
    return form
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The shortest name an import may have. */
const CSV_NAME_MIN = 2

/** The values of the import setup form: the name, what the rows are and the refresh schedule (minutes, empty is manual). */
export interface CsvImportValues {
    name: string
    entity: string
    schedule: string
}

/** The import setup form: a zod schema whose message comes from the `connectorCsv` catalog. */
export const useCsvImportForm = (initial?: Partial<CsvImportValues>) => {
    const t = useTranslations("connectorCsv")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(CSV_NAME_MIN, t("nameTooShort")),
                entity: z.string(),
                schedule: z.string(),
            }),
        [t],
    )
    return useForm<CsvImportValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", entity: "customer", schedule: "", ...initial },
        mode: "onChange",
    })
}

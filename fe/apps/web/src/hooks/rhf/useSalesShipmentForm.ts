"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Validates the carrier and tracking code before the GraphQL shipment mutation. */
export const useSalesShipmentForm = () => {
    const t = useTranslations("workbenchSales")
    const schema = useMemo(
        () =>
            z.object({
                carrier: z
                    .string()
                    .trim()
                    .min(1, t("errCarrier"))
                    .max(80, t("formTextTooLong", { n: 80 })),
                tracking: z
                    .string()
                    .trim()
                    .min(1, t("errTracking"))
                    .max(80, t("formTextTooLong", { n: 80 })),
            }),
        [t],
    )

    return useForm<{ carrier: string; tracking: string }>({
        resolver: zodResolver(schema),
        defaultValues: { carrier: "", tracking: "" },
        mode: "onSubmit",
    })
}

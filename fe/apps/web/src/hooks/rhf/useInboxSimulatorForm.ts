"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The editable values of the inbound simulator. */
export interface InboxSimulatorFormValues {
    channel: string
    kind: string
    name: string
    contact: string
    body: string
    amount: number
    reference: string
    items: string
    eventId: string
}

/** Validates the simulator against the backend input bounds with translated messages. */
export const useInboxSimulatorForm = (initialEventId: string) => {
    const t = useTranslations("inbox")
    const schema = useMemo(
        () =>
            z.object({
                channel: z
                    .string()
                    .refine(
                        (value) => ["zalo", "facebook", "email", "phone", "bank", "manual"].includes(value),
                        t("errOption"),
                    ),
                kind: z.string().refine((value) => ["message", "order", "payment"].includes(value), t("errOption")),
                name: z
                    .string()
                    .trim()
                    .min(2, t("errName"))
                    .max(120, t("errTooLong", { max: 120 })),
                contact: z
                    .string()
                    .trim()
                    .max(240, t("errTooLong", { max: 240 })),
                body: z
                    .string()
                    .trim()
                    .max(4000, t("errTooLong", { max: 4000 })),
                amount: z.custom<number>(
                    (value) =>
                        typeof value === "number" &&
                        (Number.isNaN(value) ||
                            (Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)),
                    t("errAmount", { max: Number.MAX_SAFE_INTEGER }),
                ),
                reference: z
                    .string()
                    .trim()
                    .max(240, t("errTooLong", { max: 240 })),
                items: z
                    .string()
                    .trim()
                    .max(4000, t("errTooLong", { max: 4000 })),
                eventId: z
                    .string()
                    .trim()
                    .max(160, t("errTooLong", { max: 160 })),
            }),
        [t],
    )
    return useForm<InboxSimulatorFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            channel: "zalo",
            kind: "message",
            name: "",
            contact: "",
            body: "",
            amount: Number.NaN,
            reference: "",
            items: "",
            eventId: initialEventId,
        },
        mode: "onSubmit",
    })
}

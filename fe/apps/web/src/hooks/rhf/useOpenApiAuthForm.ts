"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The values of the API address and authentication step. */
export interface OpenApiAuthValues {
    baseUrl: string
    authType: "none" | "header" | "query" | "bearer" | "basic"
    authName: string
    authValue: string
    authUser: string
    authPassword: string
}

/** The API address and authentication form: the base URL is http(s) and a key in a header or query needs its name. */
export const useOpenApiAuthForm = () => {
    const t = useTranslations("connectorOpenapi")
    const schema = useMemo(
        () =>
            z
                .object({
                    baseUrl: z.string().trim().regex(/^https?:\/\/\S+$/iu, t("baseUrlInvalid")),
                    authType: z.enum(["none", "header", "query", "bearer", "basic"]),
                    authName: z.string(),
                    authValue: z.string(),
                    authUser: z.string(),
                    authPassword: z.string(),
                })
                .refine(
                    (v) => (v.authType !== "header" && v.authType !== "query") || v.authName.trim() !== "",
                    { path: ["authName"], message: t("authNameRequired") },
                ),
        [t],
    )
    return useForm<OpenApiAuthValues>({
        resolver: zodResolver(schema),
        defaultValues: { baseUrl: "", authType: "none", authName: "", authValue: "", authUser: "", authPassword: "" },
        mode: "onChange",
    })
}

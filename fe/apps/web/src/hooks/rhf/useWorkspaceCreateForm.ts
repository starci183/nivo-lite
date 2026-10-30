"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
    BUSINESS_TYPE_MAX,
    OTHER_BUSINESS_TYPE,
    WORKSPACE_BUSINESS_TYPES,
    WORKSPACE_NAME_MAX,
    WORKSPACE_NAME_MIN,
} from "@/hooks/workspaces"
import type { WorkspaceBusinessType } from "@/hooks/workspaces"

/** The values of the create workspace form. */
export interface WorkspaceCreateValues {
    name: string
    businessType: WorkspaceBusinessType
    /** The owner's own words when the business type is `other`. */
    customIndustry: string
}

/** The create workspace form: a zod schema whose messages come from the `onboarding` catalog, validated before the mutation runs. */
export const useWorkspaceCreateForm = () => {
    const t = useTranslations("onboarding")
    const schema = useMemo(
        () =>
            z
                .object({
                    name: z.string().trim().min(WORKSPACE_NAME_MIN, t("errName")).max(WORKSPACE_NAME_MAX, t("errName")),
                    businessType: z.enum(WORKSPACE_BUSINESS_TYPES),
                    customIndustry: z.string().trim().max(BUSINESS_TYPE_MAX, t("errIndustry")),
                })
                .refine((values) => values.businessType !== OTHER_BUSINESS_TYPE || values.customIndustry.length > 0, {
                    message: t("errIndustry"),
                    path: ["customIndustry"],
                }),
        [t],
    )
    return useForm<WorkspaceCreateValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", businessType: WORKSPACE_BUSINESS_TYPES[0], customIndustry: "" },
        mode: "onSubmit",
    })
}

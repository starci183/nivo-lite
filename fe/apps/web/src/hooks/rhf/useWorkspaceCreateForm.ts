"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN } from "@/hooks/workspaces"

/** The values of the create workspace form. */
export interface WorkspaceCreateValues {
    name: string
}

/** The create workspace form: a zod schema whose messages come from the `onboarding` catalog, validated before the mutation runs. */
export const useWorkspaceCreateForm = () => {
    const t = useTranslations("onboarding")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(WORKSPACE_NAME_MIN, t("errName")).max(WORKSPACE_NAME_MAX, t("errName")),
            }),
        [t],
    )
    return useForm<WorkspaceCreateValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "" },
        mode: "onSubmit",
    })
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { INPUT_BOUNDS } from "@/modules/api"

/** The values of the workspace settings form. */
export interface WorkspaceSettingsValues {
    name: string
    timeZone: string
}

/** What the contract allows the name and the zone of a workspace (read from the generated bounds, never copied). */
const BOUNDS = INPUT_BOUNDS.UpdateWorkspaceSettingsInput

/**
 * The name and time zone form: a zod schema whose messages come from the `settings` catalog (a name of 1 to the contract's
 * longest, a zone from `zones`); `values` is what the workspace has now.
 */
export const useWorkspaceSettingsForm = (
    values: WorkspaceSettingsValues,
    zones: ReadonlyArray<string>,
): UseFormReturn<WorkspaceSettingsValues> => {
    const t = useTranslations("settings")
    const schema = useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .trim()
                    .min(1, t("errName", { max: BOUNDS.name.maxLength }))
                    .max(BOUNDS.name.maxLength, t("errName", { max: BOUNDS.name.maxLength })),
                timeZone: z
                    .string()
                    .max(BOUNDS.timeZone.maxLength)
                    .refine((zone) => zones.includes(zone), t("errTimeZone")),
            }),
        [t, zones],
    )
    return useForm<WorkspaceSettingsValues>({
        resolver: zodResolver(schema),
        values,
        resetOptions: { keepDirtyValues: true },
        mode: "onSubmit",
    })
}

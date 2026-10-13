import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Step fields shared by assignment, addition and changing its due date. */
export interface LeadStepValues {
    title: string
    owner: string
    nextAction: string
    due: string | null
}

/** Validates the next-step form before a responsibility mutation runs. */
export const useLeadStepForm = (mode: "reassign" | "add" | "due" | null) => {
    const t = useTranslations("lead")
    const schema = useMemo(
        () =>
            z.object({
                title:
                    mode === "add"
                        ? z.string().trim().min(1, t("errStepTitle")).max(200, t("errStepTitle"))
                        : z.string(),
                owner: z.string().trim().min(1, t("errStepOwner")),
                nextAction: z.string().trim().min(1, t("errStepNext")).max(1000, t("errStepNext")),
                due: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, t("errStepDue"))
                    .nullable(),
            }),
        [mode, t],
    )
    return useForm<LeadStepValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", owner: "human", nextAction: "", due: null },
    })
}

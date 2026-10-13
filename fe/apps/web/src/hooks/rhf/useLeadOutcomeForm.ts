import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** The stage selection and its supporting evidence. */
export interface LeadOutcomeValues {
    stage: "new" | "qualified" | "proposal" | "won" | "lost" | null
    evidence: string
}

/** Every recorded stage change must include evidence. */
export const useLeadOutcomeForm = () => {
    const t = useTranslations("lead")
    const schema = useMemo(
        () =>
            z.object({
                stage: z.enum(["new", "qualified", "proposal", "won", "lost"]).nullable(),
                evidence: z.string().trim().min(1, t("errOutcomeEvidence")).max(2000, t("errOutcomeEvidence")),
            }),
        [t],
    )
    return useForm<LeadOutcomeValues>({ resolver: zodResolver(schema), defaultValues: { stage: null, evidence: "" } })
}

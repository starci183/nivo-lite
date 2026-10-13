import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Local values of the public-reply editor. */
interface LeadGenCommentValues {
    workItemId: string
    draft: string
}

/** Validates an edited public reply before requesting its approval. */
export const useLeadGenCommentForm = () => {
    const t = useTranslations("workbenchLeadGen")
    const schema = useMemo(
        () =>
            z.object({
                workItemId: z.uuid(t("commentInvalid")),
                draft: z.string().trim().min(1, t("draftRequired")).max(4000, t("draftTooLong")),
            }),
        [t],
    )
    return useForm<LeadGenCommentValues>({
        resolver: zodResolver(schema),
        defaultValues: { workItemId: "", draft: "" },
        mode: "onSubmit",
    })
}

"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useLeadFreeze } from "@/hooks/leadFreeze"
import { LeadFreezeBase } from "./component"

/** The route of a run page. */
type RunRoute = { readonly runId?: string }

/** The connected card of a frozen customer on a run page: the run comes from the route; it reads the freeze itself and draws nothing while the customer is not frozen. */
export const LeadFreeze = () => {
    const t = useTranslations("leadFreeze")
    const route = useParams<RunRoute>()
    const { freeze, isAnswering, answer } = useLeadFreeze({ leadId: "", runId: route.runId ?? "" })
    if (freeze === null) return null
    return (
        <LeadFreezeBase
            props={{
                title: t("group"),
                status: freeze.isRetrying ? t("retrying") : t("waiting"),
                statusTerm: t("statusTerm"),
                stepTerm: t("stepTerm"),
                step: freeze.stepTitle ?? t("unknownStep"),
                pendingTerm: t("pendingTerm"),
                pending: t("pendingCount", { n: freeze.pendingCount }),
                heldTerm: t("heldTerm"),
                heldBy: freeze.heldBy,
                retryLabel: t("retry"),
                takeOverLabel: t("takeOver"),
                skipLabel: t("skip"),
                caption: t("caption"),
                isAnswering,
            }}
            on={{
                retry: () => answer("retry"),
                takeOver: () => answer("take_over"),
                skip: () => answer("skip"),
            }}
        />
    )
}

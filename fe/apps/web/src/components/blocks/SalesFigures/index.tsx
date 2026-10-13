"use client"

import { useFormatter, useTranslations } from "next-intl"
import { salesFiguresOf } from "@/hooks/salesfigures"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { SalesFiguresBase } from "./component"

/** The connected ribbon of the Sales workbench, read from the same workbench query as the tabs. */
export const SalesFigures = () => {
    const t = useTranslations("workbenchSales")
    const frame = useTranslations("agentDashboard")
    const format = useFormatter()
    const workbench = useSalesWorkbench()
    const data = workbench.data
    const money = (amount: number | null): string =>
        amount === null ? "-" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const terms = [
        { id: "open", term: t("metricOpen"), description: "" },
        { id: "proposal", term: t("metricProposal"), description: "" },
        { id: "won", term: t("metricWon"), description: "" },
        { id: "conversion", term: t("metricConversion"), description: "" },
    ]
    return (
        <SalesFiguresBase
            props={{
                label: frame("ribbonAria"),
                isLoading: data === null,
                isFailed: workbench.isFailed,
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                items: data === null ? terms : salesFiguresOf(data.metrics, { t, money }),
            }}
        />
    )
}

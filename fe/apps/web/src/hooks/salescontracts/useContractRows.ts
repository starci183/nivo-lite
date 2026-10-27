"use client"

import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import type { SalesContract } from "@/modules/types"
import { CONTRACT_TONES, contractDaysLeft, isoDayText } from "./salescontracts.shared"

/** A contract row with every word resolved. */
interface ContractRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly when: { readonly text: string; readonly tone: BadgeTone } | null
}

const SOON_DAYS = 14

/** Words the rows of the contracts list: the plan and the period, the status and how long an active contract still runs. */
export const useContractRows = (today: string): ((contract: SalesContract) => ContractRow) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const whenOf = (contract: SalesContract): ContractRow["when"] => {
        if (contract.status !== "active") return null
        const left = contractDaysLeft(contract.ends_on, today)
        if (left < 0) return { text: t("contractOverdue", { n: -left }), tone: "danger" }
        if (left === 0) return { text: t("contractToday"), tone: "warning" }
        return { text: t("contractInDays", { n: left }), tone: left <= SOON_DAYS ? "warning" : "neutral" }
    }
    return (contract) => ({
        id: contract.id,
        title: contract.customer_name,
        description: [
            contract.plan,
            `${isoDayText(contract.starts_on)} - ${isoDayText(contract.ends_on)}`,
            contract.amount_vnd != null
                ? format.number(contract.amount_vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        statusLabel: t(`contractStatus_${contract.status}`),
        statusTone: CONTRACT_TONES[contract.status],
        when: whenOf(contract),
    })
}

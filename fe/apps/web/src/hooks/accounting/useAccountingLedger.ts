"use client"

import type { AccountingWorkbenchData } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { lineageItemsOf, moneyOf, accountingStampOf } from "@/modules/utils"
import { useCreateAccountingAdjustment } from "./useCreateAccountingAdjustment"
import { ledgerRecordsOf } from "@/hooks/accountingRecords"
import { useAccountingAdjustmentForm } from "@/hooks/rhf"
import type { AccountingLedgerKind } from "@/modules/types"

type LedgerFilter = "all" | AccountingLedgerKind

/** What the drawer offers about corrections, by what the member may do. */
const adjustModeOf = (
    ready: boolean,
    canAdjust: boolean,
    isAdjusting: boolean,
): "notReady" | "managersOnly" | "form" | "button" => {
    if (!ready) return "notReady"
    if (!canAdjust) return "managersOnly"
    return isAdjusting ? "form" : "button"
}

/** The Ledger tab: the filter, the open line and the correction form live here, the drawing in the pure half. */
export const useAccountingLedger = (data: AccountingWorkbenchData | undefined) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [filter, setFilter] = useState<LedgerFilter>("all")
    const [openId, setOpenId] = useState<string | null>(null)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const open = data?.ledger.find((entry) => entry.id === openId) ?? null
    const closeDrawer = () => {
        setIsAdjusting(false)
        setOpenId(null)
    }
    const { form, values, error } = useAccountingAdjustmentForm()
    const { create, isSaving } = useCreateAccountingAdjustment()
    const submit = form.handleSubmit(async (input) => {
        if (open === null) return
        const saved = await create({
            targetType: open.targetType,
            targetId: open.targetId,
            note: input.note,
            correctedAmount: input.amount === "" ? null : Number(input.amount.replace(/\D/gu, "")),
        })
        if (saved !== undefined) {
            form.reset()
            closeDrawer()
        }
    })
    const closeAll = () => {
        form.reset()
        closeDrawer()
    }
    const actions = {
        selectFilter: (key: string) => setFilter(key === "income" || key === "receivable" ? key : "all"),
        openEntry: setOpenId,
        closeDrawer: closeAll,
        startAdjust: () => setIsAdjusting(true),
        cancelAdjust: () => {
            form.reset()
            setIsAdjusting(false)
        },
        changeNote: (note: string) => form.setValue("note", note, { shouldValidate: true }),
        changeAmount: (amount: string) => form.setValue("amount", amount, { shouldValidate: true }),
        submitAdjust: submit,
    }
    if (!data) return { props: null, on: actions }
    const rows = data.ledger.filter((entry) => filter === "all" || entry.kind === filter)
    return {
        props: {
            title: t("ledgerTitle"),
            intro: t("ledgerIntro"),
            foot: t("ledgerFoot"),
            empty: t("ledgerEmpty"),
            emptyBody: t("ledgerEmptyBody"),
            filterLabel: t("kindLabel"),
            filterItems: [
                { id: "all", label: t("kindAll") },
                { id: "income", label: t("kind_income") },
                { id: "receivable", label: t("kind_receivable") },
            ],
            selectedFilter: filter,
            records: ledgerRecordsOf(t, format, rows),
            drawer: {
                isOpen: open !== null,
                title: open === null ? t("ledgerTitle") : open.description,
                subtitle:
                    open === null
                        ? null
                        : `${accountingStampOf(format, open.at)} · ${t(`kind_${open.kind}`)} · ${moneyOf(format, open.amount)}`,
                closeLabel: t("close"),
                lineageTitle: t("lineageTitle"),
                lineageIntro: t("lineageIntro"),
                lineage: open === null ? [] : lineageItemsOf(t, format, open.lineage),
                adjustTitle: t("adjustTitle"),
                adjustMode: adjustModeOf(data.adjustmentsReady, data.canAdjust, isAdjusting),
                notReadyText: t("adjustNotReady"),
                managersOnlyText: t("adjustManagersOnly"),
                openLabel: t("adjustOpen"),
                form: {
                    intro: t("adjustIntro"),
                    noteLabel: t("adjustNote"),
                    noteHint: t("adjustNoteHint"),
                    amountLabel: t("adjustAmount"),
                    amountHint: t("adjustAmountHint"),
                    saveLabel: t("adjustSave"),
                    cancelLabel: t("cancel"),
                    note: values.note ?? "",
                    amount: values.amount ?? "",
                    isSaving,
                    error,
                },
            },
        },
        on: actions,
    }
}

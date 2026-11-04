"use client"

import { ledgerRecordsOf, type AccountingRecordView } from "@/hooks/accountingRecords"
import { useAccountingAdjustmentForm } from "@/hooks/rhf"
import { useScopedState } from "@/hooks/reuseables"
import type { AccountingLedgerKind, AccountingWorkbenchData } from "@/modules/types"
import {
    ledgerDrawerOf,
    ledgerLabelsOf,
    type AccountingLedgerDrawer,
    type AccountingLedgerLabels,
} from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { useAccountingSubmit } from "./useAccountingSubmit"
import { useCreateAccountingAdjustment } from "./useCreateAccountingAdjustment"

type LedgerFilter = "all" | AccountingLedgerKind

interface AdjustmentSubmission {
    readonly note: string
    readonly amount: string
}

/** The view `useAccountingLedger` returns. */
export interface AccountingLedgerView {
    props: AccountingLedgerLabels & {
        selectedFilter: LedgerFilter
        records: readonly AccountingRecordView[]
        drawer: AccountingLedgerDrawer
    }
    on: {
        selectFilter: (key: string) => void
        openEntry: (id: string) => void
        closeDrawer: () => void
        startAdjust: () => void
        cancelAdjust: () => void
        changeNote: (note: string) => void
        changeAmount: (amount: string) => void
        submitAdjust: () => void
    }
}

/** The Ledger tab: the filter, the open line and the correction form live here, the drawing in the pure half. */
export const useAccountingLedger = (
    data: AccountingWorkbenchData,
    isActive: boolean,
    scope: string,
): AccountingLedgerView => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [filter, setFilter] = useScopedState<LedgerFilter>("all", isActive, scope)
    const [openId, setOpenId] = useScopedState<string | null>(null, isActive, scope)
    const [isAdjusting, setIsAdjusting] = useScopedState(false, isActive, scope)
    const { isSaving, submit } = useAccountingSubmit(isActive, scope)
    const open = data.ledger.find((entry) => entry.id === openId) ?? null
    const closeDrawer = () => {
        setIsAdjusting(false)
        setOpenId(null)
    }
    const { form, values, error } = useAccountingAdjustmentForm()
    const reset = form.reset
    useEffect(() => {
        reset()
    }, [isActive, reset, scope])
    const { create } = useCreateAccountingAdjustment()
    const saveAdjustment = async (input: AdjustmentSubmission, isCurrent: () => boolean) => {
        if (open === null) return
        const saved = await create({
            targetType: open.targetType,
            targetId: open.targetId,
            note: input.note,
            correctedAmount: input.amount === "" ? null : Number(input.amount.replace(/\D/gu, "")),
        })
        if (saved !== undefined && isCurrent()) {
            form.reset()
            closeDrawer()
        }
    }
    const closeAll = () => {
        form.reset()
        closeDrawer()
    }
    const actions = {
        selectFilter: (key: string) =>
            setFilter(key === "income" || key === "receivable" || key === "expense" ? key : "all"),
        openEntry: (id: string) => setOpenId(id),
        closeDrawer: closeAll,
        startAdjust: () => setIsAdjusting(true),
        cancelAdjust: () => {
            form.reset()
            setIsAdjusting(false)
        },
        changeNote: (note: string) => form.setValue("note", note, { shouldValidate: true }),
        changeAmount: (amount: string) => form.setValue("amount", amount, { shouldValidate: true }),
        submitAdjust: () => submit(form, saveAdjustment),
    }
    const rows = data.ledger.filter((entry) => filter === "all" || entry.kind === filter)
    return {
        props: {
            ...ledgerLabelsOf(t),
            selectedFilter: filter,
            records: ledgerRecordsOf(t, format, rows),
            drawer: ledgerDrawerOf({ t, format, data, open, isAdjusting, values, isSaving, error }),
        },
        on: actions,
    }
}

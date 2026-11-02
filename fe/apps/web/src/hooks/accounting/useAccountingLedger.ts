"use client"

import { ledgerRecordsOf } from "@/hooks/accountingRecords"
import { useAccountingAdjustmentForm } from "@/hooks/rhf"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AccountingLedgerKind, AccountingWorkbenchData } from "@/modules/types"
import { accountingStampOf, lineageItemsOf, moneyOf } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useCreateAccountingAdjustment } from "./useCreateAccountingAdjustment"

type LedgerFilter = "all" | AccountingLedgerKind

interface AdjustmentSubmission {
    readonly note: string
    readonly amount: string
}

/** What the drawer offers about corrections, by what the member may do; a supplier payment takes none. */
const adjustModeOf = (
    ready: boolean,
    canAdjust: boolean,
    isAdjusting: boolean,
    kind: AccountingLedgerKind | null,
): "notReady" | "managersOnly" | "form" | "button" | "unavailable" => {
    if (kind === "expense") return "unavailable"
    if (!ready) return "notReady"
    if (!canAdjust) return "managersOnly"
    return isAdjusting ? "form" : "button"
}

/** The Ledger tab: the filter, the open line and the correction form live here, the drawing in the pure half. */
export const useAccountingLedger = (data: AccountingWorkbenchData, isActive: boolean, scope: string) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [filter, setFilter] = useState<LedgerFilter>("all")
    const [openId, setOpenId] = useState<string | null>(null)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const [operation, setOperation] = useState<LedgerOperation | null>(null)
    const lifetime = useFeatureLifetime(isActive, scope)
    const open = data.ledger.find((entry) => entry.id === openId) ?? null
    const closeDrawer = () => {
        setIsAdjusting(false)
        setOpenId(null)
    }
    const { form, values, error } = useAccountingAdjustmentForm()
    const reset = form.reset
    useEffect(() => {
        setFilter("all")
        setOpenId(null)
        setIsAdjusting(false)
        setOperation(null)
        reset()
    }, [isActive, reset, scope])
    const { create } = useCreateAccountingAdjustment()
    const runGraphQL = useGraphQLWithToast()
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
        submitAdjust: () => {
            const pending = { identity: lifetime.identity, isCurrent: lifetime.capture() }
            setOperation(pending)
            const finish = () => setOperation((current) => (current === pending ? null : current))
            form.handleSubmit((values) => {
                if (!pending.isCurrent()) return finish()
                saveAdjustment(values, pending.isCurrent)
                    .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
                    .finally(finish)
            }, finish)().catch((error: unknown) =>
                runGraphQL(() => Promise.reject(error), { showSuccessToast: false }).finally(finish),
            )
        },
    }
    const isSaving = isActive && operation?.identity === lifetime.identity
    const rows = data.ledger.filter((entry) => filter === "all" || entry.kind === filter)
    return {
        props: {
            ...propsLabelsOf(t),
            selectedFilter: filter,
            records: ledgerRecordsOf(t, format, rows),
            drawer: ledgerDrawerOf({ t, format, data, open, isAdjusting, values, isSaving, error }),
        },
        on: actions,
    }
}

/** A retired adjustment cannot hold busy state or clear a newer operation. */
interface LedgerOperation {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
    readonly isCurrent: () => boolean
}

/** Facts of the selected ledger line and its current adjustment form. */
interface LedgerDrawerInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchAccounting">>
    readonly format: ReturnType<typeof useFormatter>
    readonly data: AccountingWorkbenchData
    readonly open: AccountingWorkbenchData["ledger"][number] | null
    readonly isAdjusting: boolean
    readonly values: ReturnType<typeof useAccountingAdjustmentForm>["values"]
    readonly isSaving: boolean
    readonly error: string | null
}

/** Resolves the real line, permission and form facts drawn by the ledger drawer. */
const ledgerDrawerOf = (input: LedgerDrawerInput) => {
    const { t, format, data, open, isAdjusting, values, isSaving, error } = input
    const openKind = open === null ? "" : t(`kind_${open.kind}`)
    return {
        isOpen: open !== null,
        title: open === null ? t("ledgerTitle") : open.description,
        subtitle:
            open === null
                ? null
                : `${accountingStampOf(format, open.at)} · ${openKind} · ${moneyOf(format, open.amount)}`,
        closeLabel: t("close"),
        lineageTitle: t("lineageTitle"),
        lineageIntro: t("lineageIntro"),
        lineage: open === null ? [] : lineageItemsOf(t, format, open.lineage),
        adjustTitle: t("adjustTitle"),
        adjustMode: adjustModeOf(data.adjustmentsReady, data.canAdjust, isAdjusting, open?.kind ?? null),
        unavailableText: t("adjustExpenseUnavailable"),
        notReadyText: t("adjustNotReady"),
        managersOnlyText: t("adjustManagersOnly"),
        openLabel: t("adjustOpen"),
        form: { ...adjustmentFormLabelsOf(t), note: values.note ?? "", amount: values.amount ?? "", isSaving, error },
    }
}

/** Resolves the form labels for the current locale. */
const adjustmentFormLabelsOf = (t: ReturnType<typeof useTranslations<"workbenchAccounting">>) => ({
    intro: t("adjustIntro"),
    noteLabel: t("adjustNote"),
    noteHint: t("adjustNoteHint"),
    amountLabel: t("adjustAmount"),
    amountHint: t("adjustAmountHint"),
    saveLabel: t("adjustSave"),
    cancelLabel: t("cancel"),
})

/** Resolves the props labels for the current locale. */
const propsLabelsOf = (t: ReturnType<typeof useTranslations<"workbenchAccounting">>) => ({
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
        { id: "expense", label: t("kind_expense") },
    ],
})

"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { digitsToNumber, lineageItemsOf, moneyOf, stampOf } from "@/hooks/accounting"
import { ledgerRecordsOf } from "@/hooks/accountingRecords"
import { writeAdjustment } from "@/modules/db/adjustments/write-adjustment"
import { navigation } from "@/modules/i18n"
import type { AccountingLedgerEntry, AccountingLedgerKind } from "@/modules/types"
import { AccountingLedgerBase } from "./component"

/** The ledger lines and what the signed-in member may do with them. */
interface AccountingLedgerProps {
    readonly entries: ReadonlyArray<AccountingLedgerEntry>
    readonly canAdjust: boolean
    readonly adjustmentsReady: boolean
}

type LedgerFilter = "all" | AccountingLedgerKind

/** The correction as the member typed it. */
interface AdjustDraft {
    readonly note: string
    readonly amount: string
}

const EMPTY_DRAFT: AdjustDraft = { note: "", amount: "" }

/** Catalog key of the message a refusal code stands for. */
const FAILURE_KEYS: Readonly<Record<string, string>> = {
    "adjustment-note": "errAdjustNote",
    "adjustment-amount": "errAmount",
    "adjustment-target": "errTarget",
    "adjustment-input": "errTarget",
    "42P01": "errNotReady",
    PGRST205: "errNotReady",
}

/** What the drawer offers about corrections, by what the member may do. */
const adjustModeOf = (ready: boolean, canAdjust: boolean, isAdjusting: boolean) => {
    if (!ready) return "notReady"
    if (!canAdjust) return "managersOnly"
    return isAdjusting ? "form" : "button"
}

/** The Ledger tab: the filter, the open line and the correction form live here, the drawing in the pure half. */
export const AccountingLedger = (props: AccountingLedgerProps) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const router = navigation.useRouter()
    const [filter, setFilter] = useState<LedgerFilter>("all")
    const [openId, setOpenId] = useState<string | null>(null)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const [draft, setDraft] = useState<AdjustDraft>(EMPTY_DRAFT)
    const [failureCode, setFailureCode] = useState<string | null>(null)
    const [isSaving, startSaving] = useTransition()
    const closeAll = () => {
        setIsAdjusting(false)
        setOpenId(null)
        setDraft(EMPTY_DRAFT)
        setFailureCode(null)
    }
    const open = props.entries.find((entry) => entry.id === openId) ?? null
    const submitAdjust = () => {
        if (open === null) return
        setFailureCode(null)
        startSaving(async () => {
            const outcome = await writeAdjustment({
                targetType: open.targetType,
                targetId: open.targetId,
                note: draft.note,
                correctedAmount: draft.amount === "" ? null : digitsToNumber(draft.amount),
            })
            if (outcome.kind !== "ok") return setFailureCode(outcome.code)
            router.refresh()
            closeAll()
        })
    }
    const rows = props.entries.filter((entry) => filter === "all" || entry.kind === filter)
    const failureKey = failureCode === null ? null : (FAILURE_KEYS[failureCode] ?? "errTarget")
    return (
        <AccountingLedgerBase
            props={{
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
                            : `${stampOf(format, open.at)} · ${t(`kind_${open.kind}`)} · ${moneyOf(format, open.amount)}`,
                    closeLabel: t("close"),
                    lineageTitle: t("lineageTitle"),
                    lineageIntro: t("lineageIntro"),
                    lineage: open === null ? [] : lineageItemsOf(t, format, open.lineage),
                    adjustTitle: t("adjustTitle"),
                    adjustMode: adjustModeOf(props.adjustmentsReady, props.canAdjust, isAdjusting),
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
                        note: draft.note,
                        amount: draft.amount,
                        isSaving,
                        error: failureKey === null ? null : t(failureKey),
                    },
                },
            }}
            on={{
                selectFilter: (key) => setFilter(key === "income" || key === "receivable" ? key : "all"),
                openEntry: setOpenId,
                closeDrawer: closeAll,
                startAdjust: () => setIsAdjusting(true),
                cancelAdjust: () => setIsAdjusting(false),
                changeNote: (note) => setDraft((current) => ({ ...current, note })),
                changeAmount: (amount) => setDraft((current) => ({ ...current, amount })),
                submitAdjust,
            }}
        />
    )
}

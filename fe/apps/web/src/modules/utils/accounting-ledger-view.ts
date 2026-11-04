import type { AccountingLedgerKind, AccountingWorkbenchData } from "@/modules/types"
import type { useFormatter, useTranslations } from "next-intl"
import { accountingStampOf, lineageItemsOf, moneyOf, type AccountingLineageItem } from "./accounting"

type LedgerTranslator = ReturnType<typeof useTranslations<"workbenchAccounting">>

/** What the drawer offers about corrections, by what the member may do. */
export type LedgerAdjustMode = "form" | "notReady" | "managersOnly" | "button" | "unavailable"

/** The form of the correction drawer. */
export interface AccountingLedgerForm {
    note: string
    amount: string
    isSaving: boolean
    error: string | null
    intro: string
    noteLabel: string
    noteHint: string
    amountLabel: string
    amountHint: string
    saveLabel: string
    cancelLabel: string
}

/** The drawer of one ledger line. */
export interface AccountingLedgerDrawer {
    isOpen: boolean
    title: string
    subtitle: string | null
    closeLabel: string
    lineageTitle: string
    lineageIntro: string
    lineage: readonly AccountingLineageItem[]
    adjustTitle: string
    adjustMode: LedgerAdjustMode
    unavailableText: string
    notReadyText: string
    managersOnlyText: string
    openLabel: string
    form: AccountingLedgerForm
}

/** The words of the ledger tab and its filter. */
export interface AccountingLedgerLabels {
    title: string
    intro: string
    foot: string
    empty: string
    emptyBody: string
    filterLabel: string
    filterItems: {
        id: string
        label: string
    }[]
}

/** Facts of the selected ledger line and its current adjustment form. */
export interface LedgerDrawerInput {
    readonly t: LedgerTranslator
    readonly format: ReturnType<typeof useFormatter>
    readonly data: AccountingWorkbenchData
    readonly open: AccountingWorkbenchData["ledger"][number] | null
    readonly isAdjusting: boolean
    readonly values: { readonly note?: string; readonly amount?: string }
    readonly isSaving: boolean
    readonly error: string | null
}

/** What the drawer offers about corrections, by what the member may do; a supplier payment takes none. */
const adjustModeOf = (
    ready: boolean,
    canAdjust: boolean,
    isAdjusting: boolean,
    kind: AccountingLedgerKind | null,
): LedgerAdjustMode => {
    if (kind === "expense") return "unavailable"
    if (!ready) return "notReady"
    if (!canAdjust) return "managersOnly"
    return isAdjusting ? "form" : "button"
}

/** Resolves the form labels for the current locale. */
const adjustmentFormLabelsOf = (
    t: LedgerTranslator,
): Omit<AccountingLedgerForm, "note" | "amount" | "isSaving" | "error"> => ({
    intro: t("adjustIntro"),
    noteLabel: t("adjustNote"),
    noteHint: t("adjustNoteHint"),
    amountLabel: t("adjustAmount"),
    amountHint: t("adjustAmountHint"),
    saveLabel: t("adjustSave"),
    cancelLabel: t("cancel"),
})

/** Resolves the real line, permission and form facts drawn by the ledger drawer. */
export const ledgerDrawerOf = (input: LedgerDrawerInput): AccountingLedgerDrawer => {
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

/** Resolves the labels of the tab and its filter for the current locale. */
export const ledgerLabelsOf = (t: LedgerTranslator): AccountingLedgerLabels => ({
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

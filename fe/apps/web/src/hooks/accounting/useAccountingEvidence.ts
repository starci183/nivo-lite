"use client"

import { creditRecordsOf, invoiceRecordsOf, orderRecordsOf, type AccountingRecordView } from "@/hooks/accountingRecords"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import type { AccountingWorkbenchData } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { supplierNeedOf } from "@/hooks/accountingUpcoming"
import { useAccountingEvidenceEntry, type AccountingEvidenceFormState } from "./useAccountingEvidenceEntry"

/** The view `useAccountingEvidence` returns. */
export interface AccountingEvidenceView {
    props: {
        lists: {
            credits: {
                label: string
                empty: string
                emptyBody: string
                records: readonly AccountingRecordView[]
            }
            invoices: {
                label: string
                empty: string
                emptyBody: string
                records: readonly AccountingRecordView[]
            }
            orders: {
                label: string
                empty: string
                emptyBody: string
                records: readonly AccountingRecordView[]
            }
        }
        isFormOpen: boolean
        formOpenLabel: string
        form: AccountingEvidenceFormState
        creditsTitle: string
        creditsIntro: string
        creditsEmpty: string
        creditsEmptyBody: string
        credits: readonly AccountingRecordView[]
        invoicesTitle: string
        invoicesIntro: string
        invoicesEmpty: string
        invoicesEmptyBody: string
        internalNote: string
        invoices: readonly AccountingRecordView[]
        ordersTitle: string
        ordersIntro: string
        ordersEmpty: string
        ordersEmptyBody: string
        orders: readonly AccountingRecordView[]
        supplierNeed: {
            title: string
            body: string
            badge: string
            actionLabel: string
            actionHref: "/connections"
        } | null
    }
    on: {
        openForm: () => void
        closeForm: () => void
        changeField: (name: keyof AccountingEvidenceValues, value: string) => void
        submitForm: () => void
    }
}

/** The Evidence tab: credits, invoices and orders without an invoice, plus the manual evidence form. */
export const useAccountingEvidence = (
    data: AccountingWorkbenchData,
    isActive: boolean,
    scope: string,
): AccountingEvidenceView => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const entry = useAccountingEvidenceEntry(isActive, scope)
    const records = evidenceRecordsOf({ t, format, data })
    return {
        props: {
            ...records,
            lists: evidenceListsOf(records),
            isFormOpen: entry.isFormOpen,
            formOpenLabel: entry.formOpenLabel,
            form: entry.form,
        },
        on: entry.on,
    }
}

interface EvidenceRecordsInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchAccounting">>
    readonly format: ReturnType<typeof useFormatter>
    readonly data: AccountingWorkbenchData
}

/** Resolves the three evidence lists from the same workbench snapshot. */
const evidenceRecordsOf = (input: EvidenceRecordsInput) => {
    const { t, format, data } = input
    return {
        creditsTitle: t("creditsTitle"),
        creditsIntro: t("creditsIntro"),
        creditsEmpty: t(data.creditsSource === null ? "creditsNotConnected" : "creditsEmpty"),
        creditsEmptyBody: t(data.creditsSource === null ? "notConnectedHint" : "creditsEmptyBody"),
        credits: creditRecordsOf(t, format, data.credits, data.creditsSource),
        invoicesTitle: t("invoicesTitle"),
        invoicesIntro: t("invoicesIntro"),
        invoicesEmpty: t("invoicesEmpty"),
        invoicesEmptyBody: t("invoicesEmptyBody"),
        internalNote: t("internalNote"),
        invoices: invoiceRecordsOf(t, format, data.invoices),
        ordersTitle: t("ordersTitle"),
        ordersIntro: t("ordersIntro"),
        ordersEmpty: t("ordersEmpty"),
        ordersEmptyBody: t("ordersEmptyBody"),
        orders: orderRecordsOf(t, format, data.ordersWithoutInvoice),
        supplierNeed: supplierNeedOf(t, data.payablesSource),
    }
}

/** The same resolved labels and rows grouped for the three actual native record lists. */
const evidenceListsOf = (view: ReturnType<typeof evidenceRecordsOf>) => ({
    credits: {
        label: view.creditsTitle,
        empty: view.creditsEmpty,
        emptyBody: view.creditsEmptyBody,
        records: view.credits,
    },
    invoices: {
        label: view.invoicesTitle,
        empty: view.invoicesEmpty,
        emptyBody: view.invoicesEmptyBody,
        records: view.invoices,
    },
    orders: { label: view.ordersTitle, empty: view.ordersEmpty, emptyBody: view.ordersEmptyBody, records: view.orders },
})

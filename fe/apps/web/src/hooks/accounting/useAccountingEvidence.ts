"use client"

import { creditRecordsOf, invoiceRecordsOf, orderRecordsOf } from "@/hooks/accountingRecords"
import { useAccountingEvidenceForm } from "@/hooks/rhf"
import { useScopedState } from "@/hooks/reuseables"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import type { AccountingWorkbenchData } from "@/modules/types"
import { digitsToNumber, moneyOf, vietnamToday } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { useWatch } from "react-hook-form"
import { supplierNeedOf } from "@/hooks/accountingUpcoming"
import { useAccountingSubmit } from "./useAccountingSubmit"
import { useRecordManualEvidence } from "./useRecordManualEvidence"

/** The Evidence tab: credits, invoices and orders without an invoice, plus the manual evidence form. */
export const useAccountingEvidence = (data: AccountingWorkbenchData, isActive: boolean, scope: string) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [isFormOpen, setIsFormOpen] = useScopedState(false, isActive, scope)
    const [isDuplicate, setIsDuplicate] = useScopedState(false, isActive, scope)
    const { isSaving, submit } = useAccountingSubmit(isActive, scope)
    const form = useAccountingEvidenceForm()
    const reset = form.reset
    useEffect(() => {
        reset()
    }, [isActive, reset, scope])
    const fields = useWatch({ control: form.control })
    const { record } = useRecordManualEvidence()
    const today = vietnamToday()
    const closeForm = () => {
        setIsFormOpen(false)
        form.reset()
        setIsDuplicate(false)
    }
    const recordValues = async (values: AccountingEvidenceValues, isCurrent: () => boolean) => {
        setIsDuplicate(false)
        const recorded = await record({
            amount: digitsToNumber(values.amount) ?? 0,
            date: values.date,
            content: values.content,
            note: values.note,
            payer: values.payer,
        })
        if (recorded === undefined || !isCurrent()) return
        if (recorded.duplicate) return setIsDuplicate(true)
        closeForm()
    }
    const error = Object.values(form.formState.errors).find((failure) => failure.message)?.message ?? null

    const actions = {
        openForm: () => setIsFormOpen(true),
        closeForm,
        changeField: (name: keyof AccountingEvidenceValues, value: string) =>
            form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        submitForm: () => submit(form, recordValues),
    }
    const records = evidenceRecordsOf({ t, format, data })
    return {
        props: {
            ...records,
            lists: evidenceListsOf(records),
            isFormOpen,
            formOpenLabel: t("manualOpen"),
            form: evidenceFormOf({ t, format, fields, today, isSaving, error, isDuplicate }),
        },
        on: actions,
    }
}

/** Resolved input values and facts of the manual-evidence form. */
interface EvidenceFormInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchAccounting">>
    readonly format: ReturnType<typeof useFormatter>
    readonly fields: Partial<AccountingEvidenceValues>
    readonly today: string
    readonly isSaving: boolean
    readonly error: string | null
    readonly isDuplicate: boolean
}

/** The form's own words and current values, independent of its command lifecycle. */
const evidenceFormOf = (input: EvidenceFormInput) => {
    const { t, format, fields, today, isSaving, error, isDuplicate } = input
    return {
        title: t("manualTitle"),
        intro: t("manualIntro"),
        amountLabel: t("fAmount"),
        amountHint: !fields.amount ? null : moneyOf(format, digitsToNumber(fields.amount)),
        ...evidenceFormLabelsOf(t),
        amount: fields.amount ?? "",
        date: fields.date || today,
        maxDate: today,
        content: fields.content ?? "",
        payer: fields.payer ?? "",
        note: fields.note ?? "",
        isSaving,
        error,
        notice: isDuplicate ? t("manualDuplicate") : null,
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

/** Resolves the form labels for the current locale. */
const evidenceFormLabelsOf = (t: ReturnType<typeof useTranslations<"workbenchAccounting">>) => ({
    dateLabel: t("fDate"),
    contentLabel: t("fContent"),
    contentHint: t("fContentHint"),
    payerLabel: t("fPayer"),
    noteLabel: t("fNote"),
    saveLabel: t("manualSave"),
    cancelLabel: t("cancel"),
    foot: t("manualFoot"),
})

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

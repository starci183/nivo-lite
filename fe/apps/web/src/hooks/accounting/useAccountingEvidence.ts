"use client"

import { creditRecordsOf, invoiceRecordsOf, orderRecordsOf } from "@/hooks/accountingRecords"
import { useAccountingEvidenceForm } from "@/hooks/rhf"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import type { AccountingWorkbenchData } from "@/modules/types"
import { digitsToNumber, moneyOf, vietnamToday } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import { useRecordManualEvidence } from "./useRecordManualEvidence"

/** The Evidence tab: credits, invoices and orders without an invoice, plus the manual evidence form. */
export const useAccountingEvidence = (data: AccountingWorkbenchData | undefined) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDuplicate, setIsDuplicate] = useState(false)
    const form = useAccountingEvidenceForm()
    const fields = useWatch({ control: form.control })
    const { record, isRecording } = useRecordManualEvidence()
    const isSaving = isRecording || form.formState.isSubmitting
    const today = vietnamToday()
    const closeForm = () => {
        setIsFormOpen(false)
        form.reset()
        setIsDuplicate(false)
    }
    const submitForm = form.handleSubmit(async (values) => {
        setIsDuplicate(false)
        const recorded = await record({
            amount: digitsToNumber(values.amount) ?? 0,
            date: values.date,
            content: values.content,
            note: values.note,
            payer: values.payer,
        })
        if (recorded === undefined) return
        if (recorded.duplicate) return setIsDuplicate(true)
        closeForm()
    })
    const error = Object.values(form.formState.errors).find((failure) => failure.message)?.message ?? null

    const actions = {
        openForm: () => setIsFormOpen(true),
        closeForm,
        changeField: (name: keyof AccountingEvidenceValues, value: string) =>
            form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        submitForm: () => {
            void submitForm()
        },
    }
    if (!data) return { props: null, on: actions }
    return {
        props: {
            creditsTitle: t("creditsTitle"),
            creditsIntro: t("creditsIntro"),
            creditsEmpty: t("creditsEmpty"),
            creditsEmptyBody: t("creditsEmptyBody"),
            credits: creditRecordsOf(t, format, data.credits),
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
            isFormOpen,
            formOpenLabel: t("manualOpen"),
            form: {
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
            },
        },
        on: actions,
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

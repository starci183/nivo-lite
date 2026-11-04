"use client"

import { useAccountingEvidenceForm } from "@/hooks/rhf"
import { useScopedState } from "@/hooks/reuseables"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import { digitsToNumber, moneyOf, vietnamToday } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { useWatch } from "react-hook-form"
import { useAccountingSubmit } from "./useAccountingSubmit"
import { useRecordManualEvidence } from "./useRecordManualEvidence"

/** The manual-evidence form as the tab draws it: its words and current values. */
export interface AccountingEvidenceForm {
    amount: string
    date: string
    maxDate: string
    content: string
    payer: string
    note: string
    isSaving: boolean
    error: string | null
    notice: string | null
    dateLabel: string
    contentLabel: string
    contentHint: string
    payerLabel: string
    noteLabel: string
    saveLabel: string
    cancelLabel: string
    foot: string
    title: string
    intro: string
    amountLabel: string
    amountHint: string | null
}

/** The manual-evidence entry the Evidence tab shows: the open form and the actions on it. */
export interface AccountingEvidenceEntry {
    isFormOpen: boolean
    formOpenLabel: string
    form: AccountingEvidenceForm
    on: {
        openForm: () => void
        closeForm: () => void
        changeField: (name: keyof AccountingEvidenceValues, value: string) => void
        submitForm: () => void
    }
}

/** The manual evidence form of the Evidence tab: it opens, takes fields, records and answers a duplicate. */
export const useAccountingEvidenceEntry = (isActive: boolean, scope: string): AccountingEvidenceEntry => {
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
    return {
        isFormOpen,
        formOpenLabel: t("manualOpen"),
        form: evidenceFormOf({ t, format, fields, today, isSaving, error, isDuplicate }),
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

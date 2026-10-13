"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { digitsToNumber, moneyOf, vietnamToday } from "@/hooks/accounting"
import { creditRecordsOf, invoiceRecordsOf, orderRecordsOf } from "@/hooks/accountingRecords"
import { writeManualEvidence } from "@/modules/db/evidence/write-manual-evidence"
import { navigation } from "@/modules/i18n"
import type { AccountingCredit, AccountingInvoice, AccountingOrder } from "@/modules/types"
import { AccountingEvidenceBase } from "./component"

/** The evidence the Evidence tab lists. */
interface AccountingEvidenceProps {
    readonly credits: ReadonlyArray<AccountingCredit>
    readonly invoices: ReadonlyArray<AccountingInvoice>
    readonly orders: ReadonlyArray<AccountingOrder>
}

/** The form fields as the owner typed them. */
interface EvidenceFields {
    readonly amount: string
    readonly date: string
    readonly content: string
    readonly payer: string
    readonly note: string
}

/** How the last save ended: nothing yet, a refusal with its code, or "this evidence already exists". */
type EvidenceStatus =
    { readonly kind: "idle" } | { readonly kind: "failed"; readonly code: string } | { readonly kind: "duplicate" }

const EMPTY_FIELDS: EvidenceFields = { amount: "", date: "", content: "", payer: "", note: "" }

/** Catalog key of the message a refusal code stands for. */
const FAILURE_KEYS: Readonly<Record<string, string>> = {
    "evidence-amount": "errAmount",
    "evidence-date": "errDate",
    "evidence-content": "errContent",
}

/** The Evidence tab: credits, invoices and orders without an invoice, plus the manual evidence form. */
export const AccountingEvidence = (props: AccountingEvidenceProps) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const router = navigation.useRouter()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [fields, setFields] = useState<EvidenceFields>(EMPTY_FIELDS)
    const [status, setStatus] = useState<EvidenceStatus>({ kind: "idle" })
    const [isSaving, startSaving] = useTransition()
    const today = vietnamToday()
    const closeForm = () => {
        setIsFormOpen(false)
        setFields(EMPTY_FIELDS)
        setStatus({ kind: "idle" })
    }
    const submitForm = () => {
        setStatus({ kind: "idle" })
        startSaving(async () => {
            const outcome = await writeManualEvidence({
                amount: digitsToNumber(fields.amount) ?? 0,
                date: fields.date === "" ? today : fields.date,
                content: fields.content,
                note: fields.note,
                payer: fields.payer,
            })
            if (outcome.kind !== "ok") return setStatus({ kind: "failed", code: outcome.code })
            if (outcome.value.duplicate) return setStatus({ kind: "duplicate" })
            router.refresh()
            closeForm()
        })
    }
    const failureKey = status.kind === "failed" ? (FAILURE_KEYS[status.code] ?? "loadFailedBody") : null

    return (
        <AccountingEvidenceBase
            props={{
                creditsTitle: t("creditsTitle"),
                creditsIntro: t("creditsIntro"),
                creditsEmpty: t("creditsEmpty"),
                creditsEmptyBody: t("creditsEmptyBody"),
                credits: creditRecordsOf(t, format, props.credits),
                invoicesTitle: t("invoicesTitle"),
                invoicesIntro: t("invoicesIntro"),
                invoicesEmpty: t("invoicesEmpty"),
                invoicesEmptyBody: t("invoicesEmptyBody"),
                internalNote: t("internalNote"),
                invoices: invoiceRecordsOf(t, format, props.invoices),
                ordersTitle: t("ordersTitle"),
                ordersIntro: t("ordersIntro"),
                ordersEmpty: t("ordersEmpty"),
                ordersEmptyBody: t("ordersEmptyBody"),
                orders: orderRecordsOf(t, format, props.orders),
                isFormOpen,
                formOpenLabel: t("manualOpen"),
                form: {
                    title: t("manualTitle"),
                    intro: t("manualIntro"),
                    amountLabel: t("fAmount"),
                    amountHint: fields.amount === "" ? null : moneyOf(format, digitsToNumber(fields.amount)),
                    dateLabel: t("fDate"),
                    contentLabel: t("fContent"),
                    contentHint: t("fContentHint"),
                    payerLabel: t("fPayer"),
                    noteLabel: t("fNote"),
                    saveLabel: t("manualSave"),
                    cancelLabel: t("cancel"),
                    foot: t("manualFoot"),
                    amount: fields.amount,
                    date: fields.date === "" ? today : fields.date,
                    maxDate: today,
                    content: fields.content,
                    payer: fields.payer,
                    note: fields.note,
                    isSaving,
                    error: failureKey === null ? null : t(failureKey),
                    notice: status.kind === "duplicate" ? t("manualDuplicate") : null,
                },
            }}
            on={{
                openForm: () => setIsFormOpen(true),
                closeForm,
                changeField: (name, value) => setFields((current) => ({ ...current, [name]: value })),
                submitForm,
            }}
        />
    )
}

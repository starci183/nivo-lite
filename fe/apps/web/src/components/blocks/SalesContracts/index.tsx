"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useSalesContractForm } from "@/hooks/rhf"
import { parseAmount, useSalesActions, vietnamDay } from "@/hooks/sales"
import {
    CONTRACT_IMPORT_FIELDS,
    CONTRACT_STATUS_KEYS,
    CONTRACT_TONES,
    NO_LEAD,
    contractDateOf,
    contractDaysLeft,
    contractFormOf,
    contractStatusOf,
    isoDayText,
    useContractImport,
} from "@/hooks/salescontracts"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { SalesContract } from "@/modules/types"
import {
    NO_IMPORT_COLUMN,
    SalesContractsBase,
    createContractDrawer,
    createContractImportDialog,
    createSalesContractsState,
    type SalesContractsControllerInput,
} from "./component"

const createSalesContractsActions = (input: SalesContractsControllerInput) => {
    const context = createSalesContractsState(input, {
        contractDaysLeft,
        isoDayText,
        contractTones: CONTRACT_TONES,
        contractFormOf,
    })
    const { t, actions, leads, editing, isOpen, setNote, form, values, close } = context

    const submit = form.handleSubmit(async (submitted) => {
        if (!isOpen || actions.isMutating) return
        const result = await actions.saveContract({
            contractId: editing?.id ?? null,
            leadId: submitted.leadId === NO_LEAD ? null : submitted.leadId,
            customerName: submitted.customerName,
            plan: submitted.plan,
            startsOn: submitted.startsOn,
            endsOn: submitted.endsOn,
            amountVnd: parseAmount(submitted.amount),
            status: submitted.status,
            note: submitted.note,
        })
        if (result === undefined) return
        setNote(t("contractSaved"))
        close()
    })
    const pickLead = (value: string) => {
        if (!isOpen) return
        const lead = leads.find((candidate) => candidate.id === value)
        const named = value !== NO_LEAD && value !== "" && !values.customerName.trim()
        form.setValue("leadId", value || NO_LEAD, { shouldValidate: form.formState.isSubmitted })
        if (named)
            form.setValue("customerName", lead?.name.split(" · ")[0] ?? "", {
                shouldValidate: form.formState.isSubmitted,
            })
    }
    return { ...context, submit, pickLead }
}

/** The contracts surface: which contract the drawer edits, its form values, the save and the note after it live here, the drawing in the pure half. */
export const SalesContracts = () => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const actions = useSalesActions()
    const { data, nowIso } = useSalesWorkbench()
    const contracts = data?.contracts ?? []
    const leads = data?.leadOptions ?? []
    const [editing, setEditing] = useState<SalesContract | null>(null)
    const [isOpen, setOpen] = useState(false)
    const [note, setNote] = useState("")
    const today = vietnamDay(nowIso)
    const form = useSalesContractForm(today)
    const importer = useContractImport(setNote)
    const context = createSalesContractsActions({
        t,
        format,
        actions,
        data,
        nowIso,
        contracts,
        leads,
        editing,
        setEditing,
        isOpen,
        setOpen,
        note,
        setNote,
        today,
        form,
    })
    const { itemOf, open, close, submit, pickLead } = context

    if (data === null) return null
    return (
        <SalesContractsBase
            props={{
                label: t("tab_contracts"),
                intro: t("contractsIntro"),
                addLabel: t("contractAdd"),
                importLabel: t("contractImport"),
                editLabel: t("contractEdit"),
                emptyTitle: t("contractsEmptyTitle"),
                emptyBody: t("contractsEmptyBody"),
                note,
                rows: contracts.map(itemOf),
                drawer: createContractDrawer(context, {
                    noLead: NO_LEAD,
                    statusKeys: CONTRACT_STATUS_KEYS,
                    dateOf: contractDateOf,
                }),
                importDialog: createContractImportDialog({ t, format }, importer, {
                    fields: CONTRACT_IMPORT_FIELDS,
                    isoDayText,
                    contractTones: CONTRACT_TONES,
                    statusOf: contractStatusOf,
                }),
            }}
            on={{
                add: () => open(null),
                openImport: importer.open,
                importing: {
                    source: importer.source,
                    file: importer.file,
                    paste: importer.paste,
                    preview: importer.preview,
                    sheet: importer.sheet,
                    column: (field, column) =>
                        importer.column(
                            CONTRACT_IMPORT_FIELDS.find((known) => known === field) ?? "customerName",
                            column === NO_IMPORT_COLUMN ? null : column,
                        ),
                    confirm: importer.runImport,
                    close: importer.close,
                },
                edit: (contractId) => open(contracts.find((contract) => contract.id === contractId) ?? null),
                lead: pickLead,
                customer: (value) =>
                    form.setValue("customerName", value, { shouldValidate: form.formState.isSubmitted }),
                plan: (value) => form.setValue("plan", value, { shouldValidate: form.formState.isSubmitted }),
                start: (value) =>
                    form.setValue("startsOn", value?.toString() ?? "", { shouldValidate: form.formState.isSubmitted }),
                end: (value) =>
                    form.setValue("endsOn", value?.toString() ?? "", { shouldValidate: form.formState.isSubmitted }),
                amount: (value) => form.setValue("amount", value, { shouldValidate: form.formState.isSubmitted }),
                status: (value) =>
                    form.setValue("status", contractStatusOf(value), { shouldValidate: form.formState.isSubmitted }),
                note: (value) => form.setValue("note", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
                close,
            }}
        />
    )
}

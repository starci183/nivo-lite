"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { type ContractForm, useSalesContractForm } from "@/hooks/rhf"
import { parseAmount, useSalesActions } from "@/hooks/sales"
import type { SalesContract } from "@/modules/types"
import {
    CONTRACT_STATUS_KEYS,
    NO_LEAD,
    contractDateOf,
    contractFormOf,
    contractStatusOf,
} from "./salescontracts.shared"

/** One lead the contract can be linked to. */
interface LeadOption {
    readonly id: string
    readonly name: string
}

/** What the drawer needs from the surface: the leads to link, today, and where the note after a save goes. */
interface ContractDrawerInput {
    readonly leads: ReadonlyArray<LeadOption>
    readonly today: string
    readonly setNote: (note: string) => void
}

/** The first message of the form that is invalid, else null. */
const firstError = (errors: ReturnType<typeof useSalesContractForm>["formState"]["errors"]): string | null =>
    errors.customerName?.message ??
    errors.startsOn?.message ??
    errors.endsOn?.message ??
    errors.amount?.message ??
    errors.status?.message ??
    errors.plan?.message ??
    errors.note?.message ??
    null

/** What the open drawer shows: its words, the form values and the state of the save. */
interface DrawerViewInput {
    readonly isEditing: boolean
    readonly leads: ReadonlyArray<LeadOption>
    readonly values: ContractForm
    readonly error: string | null
    readonly isPending: boolean
}

/** The words and values of the contract drawer. */
const contractDrawerOf = (t: ReturnType<typeof useTranslations<"workbenchSales">>, input: DrawerViewInput) => {
    const { values } = input
    return {
        title: input.isEditing ? t("contractEditTitle") : t("contractAddTitle"),
        closeLabel: t("cancel"),
        saveLabel: t("save"),
        cancelLabel: t("cancel"),
        leadLabel: t("contractLead"),
        leadOptions: [
            { id: NO_LEAD, label: t("contractLeadNone") },
            ...input.leads.map((lead) => ({ id: lead.id, label: lead.name })),
        ],
        lead: values.leadId,
        customerLabel: t("contractCustomer"),
        customer: values.customerName,
        planLabel: t("contractPlan"),
        planHint: t("contractPlanHint"),
        plan: values.plan,
        startLabel: t("contractStart"),
        start: contractDateOf(values.startsOn),
        endLabel: t("contractEnd"),
        endHint: t("contractEndHint"),
        end: contractDateOf(values.endsOn),
        amountLabel: t("contractAmount"),
        amount: values.amount,
        statusLabel: t("contractStatus"),
        statusOptions: CONTRACT_STATUS_KEYS.map((status) => ({
            id: status,
            label: t(`contractStatus_${status}`),
        })),
        status: values.status,
        noteLabel: t("contractNote"),
        note: values.note,
        error: input.error,
        isPending: input.isPending,
        canSave: values.customerName.trim() !== "" && values.endsOn.trim() !== "",
    }
}

/** The contract drawer: which contract it edits, its form values, its words and the save. */
export const useContractDrawer = (input: ContractDrawerInput) => {
    const t = useTranslations("workbenchSales")
    const actions = useSalesActions()
    const [editing, setEditing] = useState<SalesContract | null>(null)
    const [isOpen, setOpen] = useState(false)
    const form = useSalesContractForm(contractFormOf(null, input.today))
    const values = form.watch()
    const close = () => setOpen(false)
    const open = (contract: SalesContract | null) => {
        setEditing(contract)
        form.reset(contractFormOf(contract, input.today))
        setOpen(true)
    }
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
        input.setNote(t("contractSaved"))
        close()
    })
    const validate = () => ({ shouldValidate: form.formState.isSubmitted })
    const pickLead = (value: string) => {
        if (!isOpen) return
        const lead = input.leads.find((candidate) => candidate.id === value)
        const named = value !== NO_LEAD && value !== "" && !values.customerName.trim()
        form.setValue("leadId", value || NO_LEAD, validate())
        if (named) form.setValue("customerName", lead?.name.split(" · ")[0] ?? "", validate())
    }
    const drawer = isOpen
        ? contractDrawerOf(t, {
              isEditing: editing !== null,
              leads: input.leads,
              values,
              error: firstError(form.formState.errors),
              isPending: actions.isMutating || form.formState.isSubmitting,
          })
        : null
    const on = {
        lead: pickLead,
        customer: (value: string) => form.setValue("customerName", value, validate()),
        plan: (value: string) => form.setValue("plan", value, validate()),
        start: (value: { toString: () => string } | null) =>
            form.setValue("startsOn", value?.toString() ?? "", validate()),
        end: (value: { toString: () => string } | null) => form.setValue("endsOn", value?.toString() ?? "", validate()),
        amount: (value: string) => form.setValue("amount", value, validate()),
        status: (value: string) => form.setValue("status", contractStatusOf(value), validate()),
        note: (value: string) => form.setValue("note", value, validate()),
        submit: () => void submit(),
        close,
    }
    return { drawer, on, open }
}

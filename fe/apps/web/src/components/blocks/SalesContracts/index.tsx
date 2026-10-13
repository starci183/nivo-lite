"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useSalesContractForm } from "@/hooks/rhf"
import { parseAmount, useSalesActions, vietnamDay } from "@/hooks/sales"
import {
    CONTRACT_STATUS_KEYS,
    CONTRACT_TONES,
    NO_LEAD,
    contractDateOf,
    contractDaysLeft,
    contractFormOf,
    contractStatusOf,
    isoDayText,
} from "@/hooks/salescontracts"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { SalesContract } from "@/modules/types"
import { SalesContractsBase } from "./component"
import type { ContractItemView } from "./component"

const SOON_DAYS = 14

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
    const values = form.watch()
    const errors = form.formState.errors
    const error =
        errors.customerName?.message ??
        errors.startsOn?.message ??
        errors.endsOn?.message ??
        errors.amount?.message ??
        errors.status?.message ??
        errors.plan?.message ??
        errors.note?.message ??
        null
    const isPending = actions.isMutating || form.formState.isSubmitting

    const whenOf = (contract: SalesContract): ContractItemView["when"] => {
        if (contract.status !== "active") return null
        const left = contractDaysLeft(contract.ends_on, today)
        if (left < 0) return { text: t("contractOverdue", { n: -left }), tone: "danger" }
        if (left === 0) return { text: t("contractToday"), tone: "warning" }
        return { text: t("contractInDays", { n: left }), tone: left <= SOON_DAYS ? "warning" : "neutral" }
    }
    const itemOf = (contract: SalesContract): ContractItemView => ({
        id: contract.id,
        title: contract.customer_name,
        description: [
            contract.plan,
            `${isoDayText(contract.starts_on)} - ${isoDayText(contract.ends_on)}`,
            contract.amount_vnd != null
                ? format.number(contract.amount_vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        statusLabel: t(`contractStatus_${contract.status}`),
        statusTone: CONTRACT_TONES[contract.status],
        when: whenOf(contract),
    })

    const open = (contract: SalesContract | null) => {
        setEditing(contract)
        form.reset(contractFormOf(contract, today))
        setOpen(true)
    }
    const close = () => setOpen(false)
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

    if (data === null) return null
    return (
        <SalesContractsBase
            props={{
                label: t("tab_contracts"),
                intro: t("contractsIntro"),
                addLabel: t("contractAdd"),
                editLabel: t("contractEdit"),
                emptyTitle: t("contractsEmptyTitle"),
                emptyBody: t("contractsEmptyBody"),
                note,
                rows: contracts.map(itemOf),
                drawer: !isOpen
                    ? null
                    : {
                          title: editing ? t("contractEditTitle") : t("contractAddTitle"),
                          closeLabel: t("cancel"),
                          saveLabel: t("save"),
                          cancelLabel: t("cancel"),
                          leadLabel: t("contractLead"),
                          leadOptions: [
                              { id: NO_LEAD, label: t("contractLeadNone") },
                              ...leads.map((lead) => ({ id: lead.id, label: lead.name })),
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
                          error,
                          isPending,
                          canSave: values.customerName.trim() !== "" && values.endsOn.trim() !== "",
                      },
            }}
            on={{
                add: () => open(null),
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

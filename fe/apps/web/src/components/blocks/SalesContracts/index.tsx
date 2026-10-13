"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { parseAmount, vietnamDay } from "@/hooks/sales"
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
import type { ContractForm } from "@/hooks/salescontracts"
import { writeSaveContract } from "@/modules/db/sales/write-save-contract"
import { navigation } from "@/modules/i18n"
import type { SalesContract } from "@/modules/types"
import { SalesContractsBase } from "./component"
import type { ContractItemView } from "./component"

const SOON_DAYS = 14

/** The contracts, what they can be linked to and the workspace they belong to. */
interface SalesContractsProps {
    readonly contracts: ReadonlyArray<SalesContract>
    readonly leads: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** The server clock, so server and browser agree on today. */
    readonly nowIso: string
    readonly workspaceId: string
}

/** The contracts surface: which contract the drawer edits, its form values, the save and the note after it live here, the drawing in the pure half. */
export const SalesContracts = (props: SalesContractsProps) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [editing, setEditing] = useState<SalesContract | null>(null)
    const [form, setForm] = useState<ContractForm | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [note, setNote] = useState("")
    const today = vietnamDay(props.nowIso)
    const patch = (values: Partial<ContractForm>) =>
        setForm((previous) => (previous === null ? null : { ...previous, ...values }))

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
        setError(null)
        setEditing(contract)
        setForm(contractFormOf(contract, today))
    }
    const close = () => setForm(null)
    const submit = () => {
        if (form === null) return
        setError(null)
        startTransition(async () => {
            const result = await writeSaveContract({
                id: editing ? editing.id : null,
                workspaceId: props.workspaceId,
                leadId: form.leadId === NO_LEAD ? null : form.leadId,
                customerName: form.customerName,
                plan: form.plan,
                startsOn: form.startsOn,
                endsOn: form.endsOn,
                amountVnd: parseAmount(form.amount),
                status: form.status,
                note: form.note,
            })
            if (result.kind !== "ok") {
                setError(t("actionFailed", { error: result.kind === "unavailable" ? result.code : result.kind }))
                return
            }
            setNote(t("contractSaved"))
            close()
            router.refresh()
        })
    }
    const pickLead = (value: string) => {
        if (form === null) return
        const lead = props.leads.find((candidate) => candidate.id === value)
        const named = value !== NO_LEAD && value !== "" && !form.customerName.trim()
        patch({
            leadId: value || NO_LEAD,
            customerName: named ? (lead?.name.split(" · ")[0] ?? "") : form.customerName,
        })
    }

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
                rows: props.contracts.map(itemOf),
                drawer:
                    form === null
                        ? null
                        : {
                              title: editing ? t("contractEditTitle") : t("contractAddTitle"),
                              closeLabel: t("cancel"),
                              saveLabel: t("save"),
                              cancelLabel: t("cancel"),
                              leadLabel: t("contractLead"),
                              leadOptions: [
                                  { id: NO_LEAD, label: t("contractLeadNone") },
                                  ...props.leads.map((lead) => ({ id: lead.id, label: lead.name })),
                              ],
                              lead: form.leadId,
                              customerLabel: t("contractCustomer"),
                              customer: form.customerName,
                              planLabel: t("contractPlan"),
                              planHint: t("contractPlanHint"),
                              plan: form.plan,
                              startLabel: t("contractStart"),
                              start: contractDateOf(form.startsOn),
                              endLabel: t("contractEnd"),
                              endHint: t("contractEndHint"),
                              end: contractDateOf(form.endsOn),
                              amountLabel: t("contractAmount"),
                              amount: form.amount,
                              statusLabel: t("contractStatus"),
                              statusOptions: CONTRACT_STATUS_KEYS.map((status) => ({
                                  id: status,
                                  label: t(`contractStatus_${status}`),
                              })),
                              status: form.status,
                              noteLabel: t("contractNote"),
                              note: form.note,
                              error,
                              isPending,
                              canSave: form.customerName.trim() !== "" && form.endsOn.trim() !== "",
                          },
            }}
            on={{
                add: () => open(null),
                edit: (contractId) => open(props.contracts.find((contract) => contract.id === contractId) ?? null),
                lead: pickLead,
                customer: (value) => patch({ customerName: value }),
                plan: (value) => patch({ plan: value }),
                start: (value) => patch({ startsOn: value ? value.toString() : "" }),
                end: (value) => patch({ endsOn: value ? value.toString() : "" }),
                amount: (value) => patch({ amount: value }),
                status: (value) => patch({ status: contractStatusOf(value) }),
                note: (value) => patch({ note: value }),
                submit,
                close,
            }}
        />
    )
}

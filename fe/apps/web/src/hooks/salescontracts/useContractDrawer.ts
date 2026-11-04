"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSalesContractForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesActions } from "@/hooks/sales"
import type { SalesContract, SalesContractStatus } from "@/modules/types"
import {
    contractDrawerOf,
    firstContractError,
    NO_LEAD,
    contractFormOf,
    contractStatusOf,
} from "./salescontracts.shared"
import type { ContractLeadOption } from "./salescontracts.shared"
import { useContractSubmit } from "./useContractSubmit"
import type { ContractOperation } from "./useContractSubmit"

/** The real leads, date and mounted panel that own this contract editor. */
interface ContractDrawerInput {
    readonly leads: ReadonlyArray<ContractLeadOption>
    readonly today: string
    readonly setNote: (note: string) => void
    readonly isActive?: boolean
    readonly scope?: string
}

type UseContractDrawerResult = {
    drawer: {
        title: string
        closeLabel: string
        saveLabel: string
        cancelLabel: string
        leadLabel: string
        leadOptions: {
            id: string
            label: string
        }[]
        lead: string
        customerLabel: string
        customer: string
        planLabel: string
        planHint: string
        plan: string
        startLabel: string
        start: string
        endLabel: string
        endHint: string
        end: string
        amountLabel: string
        amount: string
        statusLabel: string
        statusOptions: {
            id: SalesContractStatus
            label: string
        }[]
        status: SalesContractStatus
        noteLabel: string
        note: string
        error: string | null
        isPending: boolean
        canSave: boolean
    } | null
    on: {
        lead: (value: string) => void
        customer: (value: string) => void
        plan: (value: string) => void
        start: (value: string) => void
        end: (value: string) => void
        amount: (value: string) => void
        status: (value: string) => void
        note: (value: string) => void
        submit: () => void
        close: () => void
    }
    open: (contract: SalesContract | null) => void
}

/** Owns the same contract form and command while its original contracts panel is present. */
export const useContractDrawer = (input: ContractDrawerInput): UseContractDrawerResult => {
    const t = useTranslations("workbenchSales")
    const isActive = input.isActive ?? true
    const scope = input.scope ?? ""
    const actions = useSalesActions(input.isActive === undefined ? undefined : { isActive, scope })
    const lifetime = useFeatureLifetime(isActive, scope)
    const [editing, setEditing] = useState<SalesContract | null>(null)
    const [isOpen, setOpen] = useState(false)
    const [operation, setOperation] = useState<ContractOperation | null>(null)
    const form = useSalesContractForm(contractFormOf(null, input.today))
    const values = form.watch()
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setEditing(null)
            setOpen(false)
            setOperation(null)
            form.reset(contractFormOf(null, input.today))
        },
    })
    const isPending = actions.isMutating || (operation?.scope === scope && operation.isCurrent())
    const close = (): void => setOpen(false)
    const open = (contract: SalesContract | null): void => {
        if (!lifetime.capture()()) return
        setEditing(contract)
        form.reset(contractFormOf(contract, input.today))
        setOpen(true)
    }
    const submit = useContractSubmit({
        form,
        actions,
        editing,
        isOpen,
        isPending,
        scope,
        capture: lifetime.capture,
        setOperation,
        onSaved: () => {
            input.setNote(t("contractSaved"))
            close()
        },
    })
    const validate = () => ({ shouldValidate: form.formState.isSubmitted })
    const pickLead = (value: string): void => {
        if (!isOpen) return
        const lead = input.leads.find((candidate) => candidate.id === value)
        const named = value !== NO_LEAD && value !== "" && !values.customerName.trim()
        form.setValue("leadId", value || NO_LEAD, validate())
        if (named) form.setValue("customerName", lead?.name.split(" · ")[0] ?? "", validate())
    }
    return {
        drawer: isOpen
            ? contractDrawerOf(t, {
                  isEditing: editing !== null,
                  leads: input.leads,
                  values,
                  error: firstContractError(form.formState.errors),
                  isPending,
              })
            : null,
        on: {
            lead: pickLead,
            customer: (value: string): void => form.setValue("customerName", value, validate()),
            plan: (value: string): void => form.setValue("plan", value, validate()),
            start: (value: string): void => form.setValue("startsOn", value, validate()),
            end: (value: string): void => form.setValue("endsOn", value, validate()),
            amount: (value: string): void => form.setValue("amount", value, validate()),
            status: (value: string): void => form.setValue("status", contractStatusOf(value), validate()),
            note: (value: string): void => form.setValue("note", value, validate()),
            submit,
            close,
        },
        open,
    }
}

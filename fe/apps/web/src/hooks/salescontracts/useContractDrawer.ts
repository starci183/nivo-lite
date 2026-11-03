"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useSalesContractForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesActions } from "@/hooks/sales"
import { digitsToNumber } from "@/modules/utils"
import type { SalesContract, SalesContractStatus } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import {
    contractDrawerOf,
    firstContractError,
    NO_LEAD,
    contractFormOf,
    contractStatusOf,
} from "./salescontracts.shared"
import type { ContractLeadOption } from "./salescontracts.shared"

/** The real leads, date and mounted panel that own this contract editor. */
interface ContractDrawerInput {
    readonly leads: ReadonlyArray<ContractLeadOption>
    readonly today: string
    readonly setNote: (note: string) => void
    readonly isActive?: boolean
    readonly scope?: string
}

interface ContractOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
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
    const runGraphQL = useGraphQLWithToast()
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
    const submit = contractSubmitOf({
        form,
        actions,
        runGraphQL,
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

interface ContractSubmitInput {
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly form: ReturnType<typeof useSalesContractForm>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly editing: SalesContract | null
    readonly isOpen: boolean
    readonly isPending: boolean
    readonly scope: string
    readonly capture: () => () => boolean
    readonly setOperation: Dispatch<SetStateAction<ContractOperation | null>>
    readonly onSaved: () => void
}

/** RHF validates locally; the original command owns remote feedback and this operation owns local completion. */
const contractSubmitOf = (input: ContractSubmitInput) => (): void => {
    const { form, actions, editing } = input
    const pending = { scope: input.scope, isCurrent: input.capture() }
    if (!pending.isCurrent() || !input.isOpen || input.isPending) return
    input.setOperation(pending)
    const finish = () => input.setOperation((current) => (current === pending ? null : current))
    form.handleSubmit((submitted) => {
        if (!pending.isCurrent()) return finish()
        actions
            .saveContract({
                contractId: editing?.id ?? null,
                leadId: submitted.leadId === NO_LEAD ? null : submitted.leadId,
                customerName: submitted.customerName,
                plan: submitted.plan,
                startsOn: submitted.startsOn,
                endsOn: submitted.endsOn,
                amountVnd: digitsToNumber(submitted.amount),
                status: submitted.status,
                note: submitted.note,
            })
            .then((result) => {
                if (result !== undefined && pending.isCurrent()) input.onSaved()
            })
            .catch((error: unknown) => input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
            .finally(finish)
    }, finish)().catch((error: unknown) =>
        input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false }).finally(finish),
    )
}

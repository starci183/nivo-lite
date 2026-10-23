"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useLeadBoard } from "@/hooks/leads"
import { fromField } from "@/modules/authority"
import type { AppliedRuleView } from "./agentProfile.shared"
import { useAssignAgentWork } from "./useAssignAgentWork"

/** The option that hands no structured work: the agent only reads the request. */
const NO_TASK = "none"

/** One choice of a select. */
interface Choice {
    readonly id: string
    readonly label: string
}

/**
 * The mini composer that hands an agent work: the request in the member's words and, when the member names it, the work the agent
 * starts on in the thread (one of the actions its rules cover, the amount in the rule's unit, the deal value and the customer).
 * Work needs a customer; a plain request does not.
 */
export const useAssignComposer = (agentId: string, rules: ReadonlyArray<AppliedRuleView>) => {
    const t = useTranslations("agentProfile")
    const g = useTranslations("governance")
    const { send, isSending } = useAssignAgentWork(agentId)
    const { slot: leads } = useLeadBoard()
    const [isOpen, setIsOpen] = useState(false)
    const [text, setText] = useState("")
    const [action, setAction] = useState(NO_TASK)
    const [amount, setAmount] = useState(Number.NaN)
    const [amountVnd, setAmountVnd] = useState(Number.NaN)
    const [leadId, setLeadId] = useState(NO_TASK)
    const hasTask = action !== NO_TASK
    const isComplete = text.trim().length > 0 && (!hasTask || leadId !== NO_TASK)
    const actions: ReadonlyArray<Choice> = [
        { id: NO_TASK, label: t("assignTaskNone") },
        ...rules.map((rule) => ({ id: rule.action, label: g(`action_${rule.action}`) })),
    ]
    const customers: ReadonlyArray<Choice> = [
        { id: NO_TASK, label: t("assignLeadNone") },
        ...(leads.items ?? []).map((lead) => ({ id: lead.id, label: lead.contact_name })),
    ]
    const submit = async () => {
        const task = hasTask ? { action, amount: fromField(amount), amountVnd: fromField(amountVnd), leadId } : null
        if (await send(text.trim(), task)) {
            setText("")
            setAction(NO_TASK)
            setIsOpen(false)
        }
    }
    return {
        isOpen,
        text,
        action,
        amount,
        amountVnd,
        leadId,
        hasTask,
        actions,
        customers,
        canSend: isComplete && !isSending,
        isSending,
        toggle: () => setIsOpen((open) => !open),
        setText,
        setAction: (value: string | null) => setAction(value ?? NO_TASK),
        setAmount,
        setAmountVnd,
        setLeadId: (value: string | null) => setLeadId(value ?? NO_TASK),
        submit: () => void submit(),
    }
}

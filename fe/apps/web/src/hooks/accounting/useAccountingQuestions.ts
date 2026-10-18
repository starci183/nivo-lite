"use client"

import { useAccountingDecisionLock } from "./useAccountingDecisionLock"
import { createAccountingQuestionsActions, propsOf } from "./accounting.shared"
import { useAccountingQuestionsForm } from "@/hooks/rhf"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { AccountingQuestion, AccountingQuestionsView } from "@/modules/types"
import { accountingQuestionDefaults } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { useWatch } from "react-hook-form"
import { useDecideAccountingQuestion } from "./useDecideAccountingQuestion"

/** Prepares every question with independent validated form paths and one backend mutation lifecycle. */
export const useAccountingQuestions = (
    questions: ReadonlyArray<AccountingQuestion>,
    ownerName: string,
): AccountingQuestionsView => {
    const t = useTranslations("office")
    const g = useTranslations("governance")
    const accounting = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const items = useMemo(() => questions.map((question) => question.item), [questions])
    const form = useAccountingQuestionsForm(items)
    const values = useWatch({ control: form.control })
    const { getValues, setValue } = form
    const [editing, setEditing] = useState<Record<string, boolean>>({})
    const lock = useAccountingDecisionLock()
    const { decide, isDeciding } = useDecideAccountingQuestion()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data: workspaces, error: membershipError } = useQueryMyWorkspacesSwr()
    const membership = workspaces?.find(
        (workspace) => workspace.member.workspaceId === activeWorkspaceId && workspace.member.status === "active",
    )?.member
    const canAct = (item: AccountingQuestion["item"]): boolean => {
        if (!activeWorkspaceId || membershipError || !membership) return false
        if (membership.role === "owner" || membership.role === "manager") return true
        return membership.staffId != null && membership.staffId === item.assigned_staff_id
    }
    useEffect(() => {
        for (const item of items)
            if (!getValues(`items.${item.id}`)) setValue(`items.${item.id}`, accountingQuestionDefaults(item))
    }, [getValues, items, setValue])
    const { cards, approve, reject, change } = createAccountingQuestionsActions({
        items,
        canAct,
        lock,
        isDeciding,
        form,
        getValues,
        decide,
        questions,
        values,
        ownerName,
        t,
        g,
        format,
        editing,
        setValue,
    })
    return {
        props: propsOf(accounting, cards),
        on: {
            approve: (id) => void approve(id),
            reject: (id) => void reject(id),
            toggleEdit: (id) => {
                const item = items.find((candidate) => candidate.id === id)
                if (!item) return
                if (editing[id]) {
                    change(id, "draft", item.proposal.draft ?? "")
                    change(id, "amount", item.proposal.amount_vnd == null ? "" : String(item.proposal.amount_vnd))
                }
                setEditing((current) => ({ ...current, [id]: !current[id] }))
            },
            changeDraft: (id, value) => change(id, "draft", value),
            changeAmount: (id, value) => change(id, "amount", value),
            changeBasis: (id, value) => change(id, "basis", value),
            changeCandidate: (id, value) => change(id, "candidateId", value ?? ""),
            changeField: (id, name, value) => setValue(`items.${id}.fields.${name}`, value, { shouldDirty: true }),
        },
    }
}

/** The watched fields used to assemble independent accounting question cards. */
export type ValuesInput1 = {
    items?: {
        [x: string]:
            | {
                  fields?: { [x: string]: string | undefined }
                  draft?: string
                  amount?: string
                  candidateId?: string
                  basis?: string
              }
            | undefined
    }
}

"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"
import { useWatch } from "react-hook-form"
import { useAccountingQuestionsForm } from "@/hooks/rhf"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type {
    AccountingQuestion,
    AccountingQuestionGroup,
    AccountingQuestionsView,
    AccountingQuestionValues,
} from "@/modules/types"
import {
    accountingQuestionDefaults,
    accountingQuestionDisplay,
    accountingQuestionEdits,
    accountingQuestionError,
} from "@/modules/utils"
import { useDecideAccountingQuestion } from "./useDecideAccountingQuestion"

const GROUPS: ReadonlyArray<AccountingQuestionGroup> = ["unclear_payment", "over_limit", "missing_data", "other"]

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
    const busy = useRef(false)
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
    const approve = async (id: string) => {
        const item = items.find((candidate) => candidate.id === id)
        if (!item || !canAct(item) || item.status !== "waiting_decision" || busy.current || isDeciding) return
        busy.current = true
        try {
            if (!(await form.trigger(`items.${id}`))) return
            const input = getValues(`items.${id}`)
            await decide({
                workItemId: id,
                decision: "approved",
                edits: accountingQuestionEdits(item, input),
                basis: item.action === "reconcile_payment" ? input.basis.trim() : undefined,
            })
        } finally {
            busy.current = false
        }
    }
    const reject = async (id: string) => {
        const item = items.find((candidate) => candidate.id === id)
        if (
            !item ||
            !canAct(item) ||
            !["waiting_decision", "failed"].includes(item.status) ||
            busy.current ||
            isDeciding
        )
            return
        busy.current = true
        try {
            await decide({ workItemId: id, decision: "rejected" })
        } finally {
            busy.current = false
        }
    }
    const cards = questions.map((question) => {
        const item = question.item
        const allowed = canAct(item)
        const defaults = accountingQuestionDefaults(item)
        const current = values.items?.[item.id]
        const input: AccountingQuestionValues = {
            ...defaults,
            ...current,
            fields: Object.fromEntries(
                Object.keys(defaults.fields).map((name) => [name, current?.fields?.[name] ?? ""]),
            ),
        }
        return {
            group: question.group,
            data: accountingQuestionDisplay({
                item,
                ownerName,
                values: input,
                t,
                g,
                format,
                canAct: allowed,
                isBusy: isDeciding || !allowed,
                isEditing: editing[item.id] ?? false,
                error: accountingQuestionError(form.formState.errors.items?.[item.id] ?? {}),
            }),
        }
    })
    const change = (id: string, name: Exclude<keyof AccountingQuestionValues, "fields">, value: string) =>
        setValue(`items.${id}.${name}`, value, { shouldDirty: true })
    return {
        props: {
            intro: accounting("questionsIntro"),
            empty: accounting("questionsEmpty"),
            emptyBody: accounting("questionsEmptyBody"),
            groups: GROUPS.map((group) => ({
                id: group,
                title: accounting(`group_${group}`),
                hint: accounting(`groupHint_${group}`),
                items: cards.filter((card) => card.group === group).map((card) => card.data),
            })).filter((group) => group.items.length > 0),
        },
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

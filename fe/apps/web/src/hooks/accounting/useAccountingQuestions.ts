"use client"

import { useAccountingDecisionLock } from "./useAccountingDecisionLock"
import { createAccountingQuestionsActions, propsOf } from "./accounting.shared"
import { useAccountingQuestionsForm } from "@/hooks/rhf"
import { useFeatureLifetime, useScopedState } from "@/hooks/reuseables"
import { useGraphQLWithToast } from "@/modules/toast"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { AccountingQuestion, AccountingQuestionsView } from "@/modules/types"
import { accountingQuestionDefaults } from "@/modules/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"
import { useWatch } from "react-hook-form"
import { useDecideAccountingQuestion } from "./useDecideAccountingQuestion"
import { readError } from "@/hooks/workspaceread"

/** Prepares every question with independent validated form paths and one backend mutation lifecycle. */
export const useAccountingQuestions = (
    questions: ReadonlyArray<AccountingQuestion>,
    ownerName: string,
    isActive: boolean,
    scope: string,
): AccountingQuestionsView => {
    const t = useTranslations("office")
    const g = useTranslations("governance")
    const accounting = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const items = useMemo(() => questions.map((question) => question.item), [questions])
    const form = useAccountingQuestionsForm(items)
    const values = useWatch({ control: form.control })
    const { getValues, setValue, reset } = form
    const [editing, setEditing] = useScopedState<Record<string, boolean>>({}, isActive, scope)
    const lock = useAccountingDecisionLock(isActive, scope)
    const { decide } = useDecideAccountingQuestion()
    const operation = useQuestionOperation(isActive, scope)
    const { activeWorkspaceId } = useActiveWorkspace()
    const swrRead = useQueryMyWorkspacesSwr()
    const { data: workspaces } = swrRead
    const membershipError = readError(swrRead)
    const membership = workspaces?.find(
        (workspace) => workspace.member.workspaceId === activeWorkspaceId && workspace.member.status === "active",
    )?.member
    const canAct = (item: AccountingQuestion["item"]): boolean => {
        if (!activeWorkspaceId || membershipError || !membership) return false
        if (membership.role === "owner" || membership.role === "manager") return true
        return membership.staffId != null && membership.staffId === item.assigned_staff_id
    }
    useEffect(() => {
        reset({ items: {} })
    }, [isActive, reset, scope])
    useEffect(() => {
        if (!isActive) return
        for (const item of items)
            if (!getValues(`items.${item.id}`)) setValue(`items.${item.id}`, accountingQuestionDefaults(item))
    }, [getValues, isActive, items, scope, setValue])
    const { cards, approve, reject, change } = createAccountingQuestionsActions({
        items,
        canAct,
        lock,
        isDeciding: operation.isDeciding,
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
            approve: (id) => operation.run(() => approve(id)),
            reject: (id) => operation.run(() => reject(id)),
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
/** The pending state contains only immutable render ownership; event liveness stays outside render. */
interface QuestionPending {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
}
/** Busy uses immutable identity; duplicate dispatch and settlement read the captured event lease only. */
const useQuestionOperation = (isActive: boolean, scope: string) => {
    const lifetime = useFeatureLifetime(isActive, scope)
    const runGraphQL = useGraphQLWithToast()
    const [operation, setOperation] = useState<QuestionPending | null>(null)
    const inFlight = useRef<{ readonly pending: QuestionPending; readonly isCurrent: () => boolean } | null>(null)
    return {
        isDeciding: isActive && operation?.identity === lifetime.identity,
        run: (action: () => Promise<void>) => {
            const isCurrent = lifetime.capture()
            if (!isCurrent() || inFlight.current?.isCurrent()) return
            const pending: QuestionPending = { identity: lifetime.identity }
            inFlight.current = { pending, isCurrent }
            setOperation(pending)
            action()
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
                .finally(() => {
                    if (inFlight.current?.pending === pending) inFlight.current = null
                    setOperation((current) => (current === pending ? null : current))
                })
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

"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import { canDecideItem, useMember } from "@/hooks/member"
import { useLeadDraftForm } from "@/hooks/rhf"
import { useSalesActions } from "@/hooks/sales"

/** The decision a person takes on a drafted message. */
export type ApprovalDecision = "approved" | "rejected"

/** What the approval controls of one waiting draft need: the draft it starts from and the id the decision is queued for. */
interface ApprovalTarget {
    readonly id: string
    readonly draft: string
}

/**
 * The approval controls of the draft waiting for a person: editing the text, queuing the approval or rejection and the state of the
 * persisted job (the Sales runner polls it). `target` is `null` while no draft waits.
 */
export const useApprovalDecision = (target: ApprovalTarget | null) => {
    const member = useMember()
    const t = useTranslations("approval")
    const actions = useSalesActions()
    const [isEditing, setIsEditing] = useState(false)
    const [pendingDecision, setPendingDecision] = useState<ApprovalDecision | null>(null)
    const [error, setError] = useState<string | null>(null)
    const form = useLeadDraftForm(target?.draft ?? "")
    const editText = useWatch({ control: form.control, name: "draft" })
    const decide = async (decision: ApprovalDecision, editedDraft?: string) => {
        if (target === null) return
        setError(null)
        setPendingDecision(decision)
        const result = await actions.decideDraft({ id: target.id, decision, editedDraft })
        if (result === undefined) {
            setPendingDecision(null)
            setError(t("stillWaiting"))
            return
        }
        setIsEditing(false)
    }
    return {
        canDecide: canDecideItem(member, undefined),
        isEditing,
        editText,
        pendingDecision: actions.isMutating ? pendingDecision : null,
        error: error ?? form.formState.errors.draft?.message ?? null,
        isMutating: actions.isMutating,
        toggleEdit: () => {
            form.reset({ draft: target?.draft ?? "" })
            setIsEditing((value) => !value)
        },
        edit: (value: string) => form.setValue("draft", value, { shouldDirty: true }),
        decide: (decision: ApprovalDecision) => {
            if (decision === "approved" && isEditing) {
                void form.handleSubmit((input) => decide(decision, input.draft))()
            } else void decide(decision)
        },
    }
}

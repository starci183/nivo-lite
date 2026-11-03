"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { commentsViewOf } from "@/hooks/leadgenView"
import { useLeadGenCommentForm } from "@/hooks/rhf"
import type { LeadGenComment } from "@/modules/types"
import { useApproveLeadGenComment } from "./useApproveLeadGenComment"

/** The view `useLeadGenComments` returns. */
export interface LeadGenCommentsViewShape {
    props: {
        label: string
        emptyTitle: string
        emptyBody: string
        draftLabel: string
        noDraft: string
        editLabel: string
        approveLabel: string
        cancelLabel: string
        saveApproveLabel: string
        retryLabel: string
        busyId: string | null
        isApproving: boolean
        rows: {
            id: string
            title: string
            description: string
            sourceLabel: string
            comment: string
            draft: string
            isEditing: boolean
            draftValue: string
            error: string | null
        }[]
    }
    on: {
        edit: (id: string) => void
        cancel: () => void
        draft: (_id: string, value: string) => void
        approve: (id: string, edited: boolean) => void
        retry: () => void
    }
}

/** The comments tab: the editor, its validation and the approval job, as the words and the actions the tab draws. */
export const useLeadGenComments = (rows: ReadonlyArray<LeadGenComment>, isActive = true): LeadGenCommentsViewShape => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const form = useLeadGenCommentForm()
    const { approve, busyId, isApproving, statusReadError, retryStatus } = useApproveLeadGenComment(isActive)
    const reset = form.reset
    useEffect(() => {
        if (!isActive) reset()
    }, [isActive, reset])
    const editingId = form.watch("workItemId")
    const draft = form.watch("draft")

    const approveRow = async (id: string, edited: boolean) => {
        if (isApproving) return
        if (edited) {
            await form.handleSubmit(async (values) => {
                if (await approve(values)) form.reset()
            })()
            return
        }
        if ((await approve({ workItemId: id })) && id === editingId) form.reset()
    }

    return {
        props: commentsViewOf(t, format, rows, {
            editingId,
            draft,
            busyId,
            isApproving,
            statusReadError,
            formError: form.formState.errors.draft?.message ?? form.formState.errors.workItemId?.message ?? null,
        }),
        on: {
            edit: (id: string) =>
                form.reset({ workItemId: id, draft: rows.find((row) => row.workItemId === id)?.draft ?? "" }),
            cancel: () => form.reset(),
            draft: (_id: string, value: string) =>
                form.setValue("draft", value, { shouldValidate: form.formState.isSubmitted }),
            approve: (id: string, edited: boolean) => {
                void approveRow(id, edited)
            },
            retry: retryStatus,
        },
    }
}

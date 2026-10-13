"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useApproveLeadGenComment, useLeadGenWorkbench } from "@/hooks/leadgen"
import { useLeadGenCommentForm } from "@/hooks/rhf"
import { LeadGenCommentsBase } from "./component"

/** The agent the workbench is read for. */
interface LeadGenCommentsProps {
    readonly installationId: string | null
}

/** Edits one public reply and queues its approval through GraphQL. */
export const LeadGenComments = (props: LeadGenCommentsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const { data } = useLeadGenWorkbench(props.installationId)
    const rows = data?.comments ?? []
    const { approve: approveComment, isApproving, busyId, errors, statusError } = useApproveLeadGenComment()
    const [editingId, setEditingId] = useState<string | null>(null)
    const form = useLeadGenCommentForm()
    const draft = form.watch("draft")

    const approve = (id: string, edited: boolean) => {
        if (edited) {
            void form.handleSubmit(async (values) => {
                if (await approveComment(id, values.draft)) setEditingId(null)
            })()
        } else void approveComment(id)
    }

    if (data === undefined) return null
    return (
        <LeadGenCommentsBase
            props={{
                label: t("commentsLabel"),
                emptyTitle: t("commentsEmptyTitle"),
                emptyBody: t("commentsEmptyBody"),
                draftLabel: t("draftLabel"),
                noDraft: t("noDraft"),
                editLabel: t("edit"),
                approveLabel: t("approve"),
                cancelLabel: t("cancel"),
                saveApproveLabel: t("saveApprove"),
                busyId,
                isBusy: isApproving,
                rows: rows.map((row) => ({
                    id: row.workItemId,
                    title: row.author ? t("commentFrom", { name: row.author }) : t("commentAnonymous"),
                    description: [
                        row.refLabel,
                        format.dateTime(new Date(row.at), {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                    ]
                        .filter(Boolean)
                        .join(" · "),
                    sourceLabel: t("sourceBadge", { platform: t(`platform_${row.platform}`), kind: t("kind_comment") }),
                    comment: row.comment,
                    draft: row.draft,
                    isEditing: editingId === row.workItemId,
                    draftValue: editingId === row.workItemId ? draft : row.draft,
                    error:
                        (editingId === row.workItemId ? form.formState.errors.draft?.message : undefined) ||
                        errors[row.workItemId] ||
                        (busyId === row.workItemId ? statusError : null),
                })),
            }}
            on={{
                edit: (id) => {
                    form.reset({ draft: rows.find((row) => row.workItemId === id)?.draft ?? "" })
                    setEditingId(id)
                },
                cancel: () => setEditingId(null),
                draft: (_id, value) => form.setValue("draft", value, { shouldValidate: form.formState.isSubmitted }),
                approve,
            }}
        />
    )
}

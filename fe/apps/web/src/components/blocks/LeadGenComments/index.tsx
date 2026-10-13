"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useBusyRow } from "@/hooks/workbench"
import { writeApproveComment } from "@/modules/db/leadgen/write-lead-gen-actions"
import type { LeadGenComment } from "@/modules/types"
import { LeadGenCommentsBase } from "./component"

/** The comments waiting for a decision. */
interface LeadGenCommentsProps {
    readonly rows: ReadonlyArray<LeadGenComment>
}

/** The comments tab: which reply is being edited and the approval live here, the drawing in the pure half. */
export const LeadGenComments = (props: LeadGenCommentsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const {
        router,
        isPending,
        startTransition,
        busyKey: busyId,
        setBusyKey: setBusyId,
        errors,
        setErrors,
    } = useBusyRow()
    const [editing, setEditing] = useState<Readonly<Record<string, string>>>({})

    const approve = (id: string, edited: boolean) => {
        setErrors((previous) => ({ ...previous, [id]: "" }))
        setBusyId(id)
        startTransition(async () => {
            const result = await writeApproveComment({ workItemId: id, draft: edited ? (editing[id] ?? null) : null })
            if (result.kind === "ok") router.refresh()
            else
                setErrors((previous) => ({
                    ...previous,
                    [id]: t("actionFailed", { error: result.kind === "unavailable" ? result.code : result.kind }),
                }))
            setBusyId(null)
        })
    }
    const without = (id: string): Readonly<Record<string, string>> =>
        Object.fromEntries(Object.entries(editing).filter(([key]) => key !== id))

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
                busyId: isPending ? busyId : null,
                rows: props.rows.map((row) => ({
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
                    isEditing: editing[row.workItemId] !== undefined,
                    draftValue: editing[row.workItemId] ?? row.draft,
                    error: errors[row.workItemId] ? errors[row.workItemId] : null,
                })),
            }}
            on={{
                edit: (id) =>
                    setEditing((previous) => ({
                        ...previous,
                        [id]: props.rows.find((row) => row.workItemId === id)?.draft ?? "",
                    })),
                cancel: (id) => setEditing(without(id)),
                draft: (id, value) => setEditing((previous) => ({ ...previous, [id]: value })),
                approve,
            }}
        />
    )
}

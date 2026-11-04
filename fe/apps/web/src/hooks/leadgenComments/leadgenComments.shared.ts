import type { LeadGenComment } from "@/modules/types"
import type { useFormatter, useTranslations } from "next-intl"

type LeadGenTranslator = ReturnType<typeof useTranslations>
type LeadGenFormat = ReturnType<typeof useFormatter>

/** Day, month and time of an instant, the way every row of the workbench writes it. */
const whenOf = (format: LeadGenFormat, iso: string): string =>
    format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/** What the comments tab knows beyond the rows: which one is edited, its draft and what is running. */
export interface CommentsViewState {
    readonly editingId: string
    readonly draft: string
    readonly busyId: string | null
    readonly isApproving: boolean
    /** The words shown when the approval job cannot be read. */
    readonly statusReadError: string | null
    /** The words shown when the edited draft is not valid. */
    readonly formError: string | null
}

/** The failure under one row: the unreadable job of the running approval, else the invalid edit. */
const commentErrorOf = (row: LeadGenComment, state: CommentsViewState): string | null => {
    if (state.busyId === row.workItemId && state.statusReadError) return state.statusReadError
    return state.editingId === row.workItemId ? state.formError : null
}

/** What `commentsViewOf` returns. */
export interface CommentsViewOfResult {
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

/** The words and rows of the comments tab. */
export const commentsViewOf = (
    t: LeadGenTranslator,
    format: LeadGenFormat,
    rows: ReadonlyArray<LeadGenComment>,
    state: CommentsViewState,
): CommentsViewOfResult => ({
    label: t("commentsLabel"),
    emptyTitle: t("commentsEmptyTitle"),
    emptyBody: t("commentsEmptyBody"),
    draftLabel: t("draftLabel"),
    noDraft: t("noDraft"),
    editLabel: t("edit"),
    approveLabel: t("approve"),
    cancelLabel: t("cancel"),
    saveApproveLabel: t("saveApprove"),
    retryLabel: t("retry"),
    busyId: state.busyId,
    isApproving: state.isApproving,
    rows: rows.map((row) => ({
        id: row.workItemId,
        title: row.author ? t("commentFrom", { name: row.author }) : t("commentAnonymous"),
        description: [row.refLabel, whenOf(format, row.at)].filter(Boolean).join(" · "),
        sourceLabel: t("sourceBadge", { platform: t(`platform_${row.platform}`), kind: t("kind_comment") }),
        comment: row.comment,
        draft: row.draft,
        isEditing: state.editingId === row.workItemId,
        draftValue: state.editingId === row.workItemId ? state.draft : row.draft,
        error: commentErrorOf(row, state),
    })),
})

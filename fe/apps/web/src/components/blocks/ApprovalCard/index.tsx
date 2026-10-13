"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { DRAFT_AGENT_GLYPH, useDecideExecution } from "@/hooks/approvalCard"
import type { ExecutionDecision } from "@/hooks/approvalCard"
import { canDecideItem, useMember } from "@/hooks/member"
import type { ExecutionRecord } from "@/modules/types"
import { ApprovalCardBase } from "./component"

const COPIED_MS = 2000

/** Props for the connected approval card. */
interface ApprovalCardProps {
    readonly execution: ExecutionRecord
    readonly leadName: string
    readonly channel: string
    readonly agentName: string | null
    readonly nextAction: string
    readonly href?: string
    /** Staff member the work item of the draft is assigned to; without it only owner and manager see decision buttons. */
    readonly assignedStaffId?: string | null
}

/** Approval card for one execution: approve (optionally edited) or reject through the back end; the outcome is toasted. */
export const ApprovalCard = (props: ApprovalCardProps) => {
    const t = useTranslations("approval")
    const common = useTranslations("common")
    const format = useFormatter()
    const member = useMember()
    const { decide } = useDecideExecution()
    const { execution } = props
    const [isEditing, setIsEditing] = useState(false)
    const [editText, setEditText] = useState(execution.draft)
    const [pendingDecision, setPendingDecision] = useState<ExecutionDecision | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    useEffect(() => {
        if (!isCopied) return undefined
        const timer = window.setTimeout(() => setIsCopied(false), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [isCopied])
    const isWaiting = execution.status === "pending_approval"
    const shown = isEditing && isWaiting ? editText : execution.draft
    const statusWord = execution.status === "approved" ? t("approved") : t("rejected")
    const clock =
        execution.decided_at === null
            ? ""
            : ` · ${format.dateTime(new Date(execution.decided_at), { hour: "2-digit", minute: "2-digit", hour12: false })}`

    const onDecide = async (decision: ExecutionDecision) => {
        setPendingDecision(decision)
        const trimmed = editText.trim()
        const edited = decision === "approved" && isEditing && trimmed !== execution.draft ? trimmed : undefined
        await decide(execution.id, decision, edited)
        setPendingDecision(null)
    }
    const onCopy = () => {
        void navigator.clipboard.writeText(shown).then(() => setIsCopied(true))
    }
    return (
        <ApprovalCardBase
            props={{
                isWaiting,
                isApproved: execution.status === "approved",
                nextAction: props.nextAction,
                willSend: t("willSend", { lead: props.leadName, channel: props.channel }),
                agentName: props.agentName,
                agentGlyph: DRAFT_AGENT_GLYPH,
                aiChip: common("aiChip"),
                needsApproval: t("needsApproval"),
                statusWord,
                draft: execution.draft,
                draftLabel: t("draftLabel"),
                isEditing,
                editText,
                characters: t("characters", { count: shown.length }),
                copyLabel: isCopied ? t("copied") : t("copy"),
                canDecide: canDecideItem(member, props.assignedStaffId),
                waitingManager: t("waitingManager"),
                approveLabel: t("approveSend"),
                editLabel: isEditing ? t("discardEdits") : t("edit"),
                rejectLabel: t("reject"),
                settledLabel: `${t("decidedBy", { status: statusWord, who: execution.decided_by ?? t("teammate") })}${clock}`,
                openLeadLabel: t("openLead"),
                href: props.href,
                pendingDecision,
            }}
            on={{
                toggleEdit: () => {
                    setEditText(execution.draft)
                    setIsEditing((value) => !value)
                },
                editChange: setEditText,
                decide: (decision) => void onDecide(decision),
                copy: onCopy,
            }}
        />
    )
}

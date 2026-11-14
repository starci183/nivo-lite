import { approvalDecisionKind, reportRunKind, type AgentMessageState } from "@nivo-lite/agent-sdk/team-chat"
import type { TeamChatApprovalView, TeamChatMessageRow, TeamChatMessagesCopy } from "@/modules/types"

/** What the card is made from: the message as the thread shows it, and the structured line an agent stored with it. */
export type CardSource = Omit<TeamChatMessageRow, "card"> & {
    readonly agentMessage: Readonly<Record<string, unknown>> | null
}

/** The state of a decision in the words of the shared message card. */
const cardStateOf = (approval: TeamChatApprovalView): AgentMessageState => {
    if (approval.status === "pending") return "waiting"
    if (approval.status === "approved") return "approved"
    return approval.status === "refused" ? "rejected" : "expired"
}

/** The line that tells how a decision was settled and by whom; empty while it is pending. */
const settledNoteOf = (approval: TeamChatApprovalView, copy: TeamChatMessagesCopy): string => {
    if (approval.status === "pending") return ""
    const by = approval.decidedBy === "" ? "" : ` ${copy.decidedBy} ${approval.decidedBy}`
    const at = approval.decidedAt === "" ? "" : ` ${approval.decidedAt}`
    if (approval.status === "approved") return `${copy.approvalApproved}${by}${at}`
    return approval.status === "refused" ? `${copy.approvalRefused}${by}${at}` : copy.approvalExpired
}

/** Whether a value is the link of a record: a label and where it opens. */
const isLink = (value: unknown): value is { readonly label: string; readonly href: string } =>
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "label") === "string" &&
    typeof Reflect.get(value, "href") === "string"

/** The place the work behind a message opens, as the card's link; none when the message has none. */
const workOf = (label: string, href: string | null) => (href === null ? undefined : { label, href })

/** The step title an approval card names in its head; empty for any other kind or an older row with no step. */
const approvalStepTitleOf = (message: Readonly<Record<string, unknown>>): string => {
    if (message["kind"] !== approvalDecisionKind.id) return ""
    const parsed = approvalDecisionKind.payload.safeParse(message["payload"])
    return parsed.success ? (parsed.data.step?.title.trim() ?? "") : ""
}

/** The head of an approval that names its step ("Needs your approval · Send quote"); nothing for a message that has no step to name. */
const approvalHeadOf = (
    message: Readonly<Record<string, unknown>>,
    copy: TeamChatMessagesCopy,
): { readonly title?: string } => {
    const step = approvalStepTitleOf(message)
    return step === "" ? {} : { title: `${copy.approvalNeeded} · ${step}` }
}

/**
 * The record the shared agent message card draws for one message of the thread. An agent line carries its own record (kind, intent,
 * payload, the work it is about); the approval an engine job posts and the report of a run carry none, so theirs is made here from
 * the row: an approval is an `approve` message in the state of its decision, a report a `report` message with the run it opens.
 * The state and the settled note of a linked decision always win over what the record said, because the decision is the truth.
 */
const agentCardRecordOf = (
    row: CardSource,
    copy: TeamChatMessagesCopy,
    hrefOf: (path: string) => string,
): Readonly<Record<string, unknown>> => {
    const { approval } = row
    const envelope = { id: row.id, agent: row.authorName, at: row.timeLabel }
    const decision =
        approval === null ? {} : { state: cardStateOf(approval), ...(approval.status === "pending" ? {} : { note: settledNoteOf(approval, copy) }) }
    if (row.agentMessage !== null) {
        const work = row.agentMessage["work"]
        return {
            ...row.agentMessage,
            ...approvalHeadOf(row.agentMessage, copy),
            ...decision,
            ...envelope,
            work: isLink(work)
                ? { label: `${copy.relatedWork} ${work.label}`, href: hrefOf(work.href) }
                : workOf(copy.workName, row.workHref),
        }
    }
    if (row.kind === "report") {
        return {
            ...envelope,
            kind: reportRunKind.id,
            intent: "report",
            title: copy.report,
            summary: row.body,
            work: workOf(copy.runName, row.workHref),
        }
    }
    return {
        ...envelope,
        ...decision,
        kind: approvalDecisionKind.id,
        intent: approval === null ? "notify" : "approve",
        title: copy.approvalTitle,
        summary: row.body,
        work: workOf(copy.workName, row.workHref),
    }
}

/**
 * The record of the shared agent message card for a message, or null when the message is a bubble: only the lines of an agent are
 * cards (its structured line, the approval it asks for, the report of a run); a person writes text and a system line is centred.
 */
export const agentCardOf = (
    row: CardSource,
    copy: TeamChatMessagesCopy,
    hrefOf: (path: string) => string,
): Readonly<Record<string, unknown>> | null =>
    row.kind !== "system" && (row.agentMessage !== null || row.kind === "approval" || row.kind === "report" || row.approval !== null)
        ? agentCardRecordOf(row, copy, hrefOf)
        : null

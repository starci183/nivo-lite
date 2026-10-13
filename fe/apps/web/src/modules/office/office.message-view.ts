import { leadHref, workItemHref } from "@/modules/routes"
import type { OfficeApprovalView, OfficeCommandView, OfficeMessageView } from "@/modules/types"
import { bodyPartsOf, isNivoLine } from "./office.helpers"
import { threadDayKey } from "./office.thread"
import type { ThreadEntry } from "./office.thread"
import type { OfficeApproval, OfficeCandidate, OfficeMessage } from "./office.types"
import { NIVO_AVATAR, avatarOfAgentId, leadNameOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

const DAY_MS = 86_400_000

/** "Today", "Yesterday" or a short date for a day key, relative to now. */
export const dayLabelOf = (key: string, words: OfficeWords, context: OfficeContext): string => {
    if (key === threadDayKey(context.nowIso)) return words.t("today")
    const yesterday = threadDayKey(new Date(new Date(context.nowIso).getTime() - DAY_MS).toISOString())
    return key === yesterday ? words.t("yesterday") : words.day(`${key}T00:00:00Z`)
}

const authorOf = (message: OfficeMessage, isNivo: boolean, words: OfficeWords): string =>
    isNivo ? words.t("nivoCore") : message.authorName

const workHrefOf = (message: OfficeMessage, context: OfficeContext): string | null => {
    const module = message.workItemId === null ? undefined : context.workModules.get(message.workItemId)
    return message.workItemId === null || module === undefined ? null : workItemHref(module, message.workItemId)
}

/** One chat line as a bubble, or a centred notice for a system line. */
export const messageView = (
    entry: Extract<ThreadEntry, { kind: "message" }>,
    words: OfficeWords,
    context: OfficeContext,
): OfficeMessageView => {
    const message: OfficeMessage = entry.message
    const isNivo = isNivoLine(message)
    const isNotice = message.authorKind === "system" && !isNivo
    const isMine = message.authorKind === "human" && message.authorName === context.meName
    const agent = context.agents.find((candidate) => candidate.id === message.agentId)
    const isAgent = message.authorKind === "agent"
    const showAuthor = !entry.isContinuation && !isMine
    const leadName = leadNameOf(context, message.leadId)
    return {
        kind: "message",
        key: entry.key,
        variant: isNotice ? "notice" : "bubble",
        side: isMine ? "outgoing" : "incoming",
        author: showAuthor ? authorOf(message, isNivo, words) : null,
        avatar: showAuthor ? avatarOfLine(message, isNivo, isAgent, context) : null,
        isAi: !entry.isContinuation && isAgent && !isNivo,
        isContinuation: entry.isContinuation,
        time: words.time(message.createdAt),
        showTime: entry.isGroupEnd,
        parts: bodyPartsOf(message.body),
        copyText: message.body,
        leadHref: message.leadId === null ? null : leadHref(message.leadId),
        leadLabel: isNotice
            ? words.t("noticeLead", { name: leadName ?? words.t("leadFallback") })
            : words.t("openLead"),
        workHref: workHrefOf(message, context),
        replyHandle: isAgent && agent !== undefined ? agent.handle : null,
    }
}

const avatarOfLine = (
    message: OfficeMessage,
    isNivo: boolean,
    isAgent: boolean,
    context: OfficeContext,
): OfficeMessageView["avatar"] => {
    if (isNivo) return NIVO_AVATAR
    if (isAgent) return avatarOfAgentId(context, message.agentId, message.authorName)
    return { kind: "person", name: message.authorName }
}

/** An approval request with its words, its status and who may decide it. */
export const approvalView = (
    approval: OfficeApproval,
    words: OfficeWords,
    context: OfficeContext,
): OfficeApprovalView => {
    const isWaiting = approval.status === "pending_approval"
    const author = approval.agentName ?? words.t("agentFallback")
    const lead = approval.leadName ?? words.t("unknownLead")
    const statusWord = words.t(approval.status === "approved" ? "approvalApproved" : "approvalRejected")
    const who = approval.decidedBy ?? words.t("teammate")
    const settled = settledLine(approval, statusWord, who, words)
    return {
        kind: "approval",
        key: `approval-${approval.id}`,
        id: approval.id,
        anchor: approvalCardAnchor(approval.id),
        author,
        avatar: avatarOfAgentId(context, approval.agentId, author),
        time: words.time(approval.createdAt),
        title: approval.nextAction,
        target:
            approval.channel === ""
                ? words.t("approvalToNoChannel", { lead })
                : words.t("approvalTo", { lead, channel: approval.channel }),
        status: approvalStatusOf(approval),
        statusLabel: isWaiting ? words.t("approvalWaiting") : statusWord,
        draft: approval.draft,
        settled: isWaiting ? words.t("approvalPolicy") : settled,
        leadHref: approval.leadId === null ? null : leadHref(approval.leadId),
        canAct: context.canDecide(approval.assignedStaffId),
        isFocused: context.focusedId === approval.id,
    }
}

const approvalStatusOf = (approval: OfficeApproval): OfficeApprovalView["status"] => {
    if (approval.status === "pending_approval") return "waiting"
    return approval.status
}

const settledLine = (approval: OfficeApproval, status: string, who: string, words: OfficeWords): string =>
    approval.decidedAt === null
        ? words.t("approvalDecidedNoTime", { status, who })
        : words.t("approvalDecided", { status, who, time: words.stamp(approval.decidedAt) })

/** The DOM id of the card of one approval request. */
export const approvalCardAnchor = (executionId: string): string => `approval-${executionId}`

/** The DOM id of the card of one exception. */
export const exceptionCardAnchor = (workItemId: string): string => `exception-${workItemId}`

const commandNoteOf = (
    candidate: OfficeCandidate,
    agent: string,
    words: OfficeWords,
    context: OfficeContext,
): string => {
    if (candidate.status === "cancelled") return words.t("cmdCancelledNote")
    if (candidate.status === "pending") return words.t("cmdGateNote", { agent })
    return words.t(context.alreadyIds.includes(candidate.id) ? "cmdAlready" : "cmdSentNote", { agent })
}

/** The confirm card of a command with its words and its next step. */
export const commandView = (
    candidate: OfficeCandidate,
    words: OfficeWords,
    context: OfficeContext,
): OfficeCommandView => {
    const agent = words.moduleName(candidate.module)
    const handle = context.agents.find((installed) => installed.module === candidate.module)?.handle ?? candidate.module
    return {
        kind: "command",
        key: `command-${candidate.id}`,
        id: candidate.id,
        anchor: `command-${candidate.id}`,
        status: candidate.status,
        avatar: NIVO_AVATAR,
        ask: words.t("cmdAsk", { handle }),
        agent,
        what: candidate.summary,
        rows: candidate.shown,
        note: commandNoteOf(candidate, agent, words, context),
        detail: candidate.status === "pending" ? candidate.refusal : null,
        workHref:
            candidate.status === "sent" && candidate.workItemId !== null
                ? workItemHref(candidate.module, candidate.workItemId)
                : null,
    }
}

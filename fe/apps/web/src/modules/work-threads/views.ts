import type { ThreadMessageType, WorkChainType } from "@/modules/api"
import type { ThreadApprovalCardView, ChainPanelView } from "@/modules/types"
import { chainStatusTone, stepKindKey } from "./chain"
import { wallClockOf, countdownOf, hasPassed } from "./countdown"

/** The words of the work threads catalog the view builders use. */
export type ThreadWords = (key: string, values?: Record<string, string | number>) => string

/** The message key that names a member's role. */
const roleKey = (role: string): string => {
    if (role === "owner") return "roleOwner"
    if (role === "manager") return "roleManager"
    return "roleStaff"
}

const capital = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`

/** The message key that names the status of a person's vote. */
const voteKey = (status: string): string => `vote${capital(status)}`

/** The message key that names the status of a chain step. */
const stepKey = (status: string): string => `step${capital(status)}`

/** The message key that names the rule of an approval. */
const policyKey = (policy: string): string => {
    if (policy === "all") return "policyAll"
    if (policy === "sequential") return "policySequential"
    return "policyAny"
}

/** The message key that names why a person was left out of an approval. */
const excludedKey = (reason: string): string => {
    if (reason === "inactive") return "excludedInactive"
    if (reason === "no_grant") return "excludedNoGrant"
    return "excludedOverLimit"
}

/** How a settled card reads: who decided it, how and at what time; an empty text while it waits. */
const decidedLineOf = (card: NonNullable<ThreadMessageType["approval"]>, t: ThreadWords): string => {
    if (card.outcome === "pending") return ""
    if (card.outcome === "expired") return t("decidedExpired")
    return t(card.outcome === "approved" ? "decidedApproved" : "decidedRejected", {
        name: card.decidedByName ?? "",
        time: card.decidedAt === null ? "" : wallClockOf(card.decidedAt),
    })
}

/** The line under a card's policy: how long it has left, that it ran out, or nothing once a person decided it. */
const expiryLineOf = (card: NonNullable<ThreadMessageType["approval"]>, now: number, t: ThreadWords): string => {
    if (card.outcome === "approved" || card.outcome === "rejected") return ""
    return card.outcome === "expired" || hasPassed(card.expiresAt, now)
        ? t("expiredLine")
        : t("expiresIn", { time: countdownOf(card.expiresAt, now) })
}

/** The approval card of a message as the card draws it. */
export const approvalViewOf = (
    message: ThreadMessageType,
    now: number,
    t: ThreadWords,
): ThreadApprovalCardView | null => {
    const card = message.approval
    if (card === null) return null
    return {
        messageId: message.id,
        title: t("approvalTitle", { action: card.action }),
        ruleLine: t("ruleLine", { rule: card.rule }),
        policyLabel: t(policyKey(card.policy)),
        expiryLine: expiryLineOf(card, now, t),
        approvers: card.approvers.map((approver) => ({
            id: approver.memberId,
            name: approver.name,
            roleLabel: t(roleKey(approver.role)),
            statusLabel: t(voteKey(approver.status)),
            tone: chainStatusTone(approver.status),
        })),
        excluded: card.excluded.map((left) => ({
            id: left.memberId,
            line: t("excludedLine", { name: left.name, reason: t(excludedKey(left.reason)) }),
        })),
        fallbackLine: card.owner === null ? null : t("fallbackLine", { name: card.owner.name }),
        isPending: card.outcome === "pending",
        decidedLine: decidedLineOf(card, t),
        decidedTone: chainStatusTone(card.outcome),
    }
}

/** The line that says where the chain stands; empty for an empty or a complete one (the complete one has its own card). */
const chainStateLine = (state: string, t: ThreadWords): string => {
    if (state === "running") return t("chainRunning")
    if (state === "stopped") return t("chainStopped")
    return ""
}

/** The Execution chain panel: the summary line, where the chain stands and the steps. */
export const chainViewOf = (chain: WorkChainType, t: ThreadWords): ChainPanelView => {
    const summary = chain.summary
    return {
        summaryLine:
            summary.state === "empty"
                ? ""
                : t("chainSummary", {
                      steps: summary.steps,
                      decisions: summary.humanDecisions,
                      minutes: summary.minutes,
                  }),
        stateLine: chainStateLine(summary.state, t),
        stateTone: chainStatusTone(summary.state),
        steps: chain.steps.map((step) => ({
            id: step.id,
            title: step.action,
            description: [step.actorName, t(stepKindKey(step.kind)), step.detail]
                .filter((part) => part !== "")
                .join(" · "),
            statusLabel: t(stepKey(step.status)),
            tone: chainStatusTone(step.status),
        })),
        isComplete: summary.state === "complete",
    }
}

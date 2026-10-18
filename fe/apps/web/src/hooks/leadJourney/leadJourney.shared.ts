import type { EventRecord, ExecutionRecord, LeadIcon, LeadJourney, ResponsibilityRecord } from "@/modules/types"

/** The bullet lines ("- text") of an AI brief. */
export const toBullets = (summary: string): ReadonlyArray<string> =>
    summary
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim())
        .filter((line) => line.length > 0)

const SIGNAL_PATTERN = /^(urgency|risk)\s*:\s*(\S.*|\s)$/i

/** One warning signal read from a bullet. */
export interface LeadSignal {
    readonly id: string
    readonly kind: "urgency" | "risk"
    readonly value: string
}

/** The urgency and risk signals among the bullets. */
export const toSignals = (bullets: ReadonlyArray<string>): ReadonlyArray<LeadSignal> =>
    bullets.flatMap((item, index): Array<LeadSignal> => {
        const match = SIGNAL_PATTERN.exec(item)
        if (match === null) return []
        const kind = (match[1] ?? "").toLowerCase() === "urgency" ? "urgency" : "risk"
        const value = (match[2] ?? "").split(/[—–;.]/)[0]?.trim() ?? ""
        return [{ id: `${index}-${kind}`, kind, value }]
    })

const EVENT_KEYS: Readonly<Record<string, string>> = {
    "lead.captured": "kindLeadCaptured",
    "context.summarised": "kindContext",
    "responsibility.assigned": "kindAssigned",
    "execution.drafted": "kindDrafted",
    "execution.approved": "kindApproved",
    "execution.rejected": "kindRejected",
    "outcome.recorded": "kindOutcome",
    "agent.installed": "kindAgentInstalled",
    "agent.updated": "kindAgentUpdated",
}

/** The catalog key of the label of an event kind; null for a kind the page has no word for. */
export const eventKindKeyOf = (kind: string): string | null => EVENT_KEYS[kind] ?? null

/** The event kinds whose evidence counts as recorded evidence. */
export const isEvidenceEvent = (event: EventRecord): boolean =>
    (event.kind === "outcome.recorded" || event.kind === "execution.approved") &&
    event.evidence !== null &&
    event.evidence !== ""

/** The drafts of a lead split into the one waiting for a decision and the earlier ones, newest first. */
export const executionsOf = (
    detail: LeadJourney,
): {
    readonly pending: ExecutionRecord | null
    readonly earlier: ReadonlyArray<ExecutionRecord>
    readonly currentStep: ResponsibilityRecord | null
} => {
    const currentStep =
        [...detail.responsibilities]
            .filter((step) => step.status !== "done")
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    const waiting = detail.executions.filter((draft) => draft.status === "pending_approval")
    const pending = waiting.find((draft) => draft.responsibility_id === currentStep?.id) ?? waiting[0] ?? null
    const earlier = detail.executions
        .filter((draft) => draft !== pending)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { pending, earlier, currentStep }
}

const EVENT_ICONS: Readonly<Record<string, LeadIcon>> = {
    "lead.captured": "account",
    "context.summarised": "brain",
    "responsibility.assigned": "pending",
    "execution.drafted": "send",
    "execution.approved": "complete",
    "execution.rejected": "close",
    "outcome.recorded": "review",
    "agent.installed": "brain",
    "agent.updated": "brain",
}

/** The icon of an event kind on the timeline; a kind with no icon shows a bell. */
export const eventIconOf = (kind: string): LeadIcon => EVENT_ICONS[kind] ?? "notification"

/** The icon of a brief bullet: a warning signal shows a bell, any other line the brain. */
export const bulletIconOf = (text: string): LeadIcon => (/^(urgency|risk)\s*:/i.test(text) ? "notification" : "brain")

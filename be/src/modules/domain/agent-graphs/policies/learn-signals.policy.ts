import { TRUST_THRESHOLD } from "../agent-graphs.contracts"
import type { ClosedDecision, LearnedProposal } from "../agent-graphs.contracts"

/** How many of the latest decisions on one branch are looked at for a rejection or a timeout, and how many hits make a signal. */
export const WINDOW = 10
export const REJECT_HITS = 5
export const TIMEOUT_HITS = 3

const trusted = (decision: ClosedDecision): boolean => decision.closedAs === "approved"
const disliked = (decision: ClosedDecision): boolean => decision.closedAs === "rejected" || decision.closedAs === "edited"

/** The decisions of one branch, oldest first. */
const ofBranch = (decisions: ReadonlyArray<ClosedDecision>, branchKey: string): ReadonlyArray<ClosedDecision> =>
    decisions.filter((decision) => decision.branchKey === branchKey)

const proposal = (
    signal: LearnedProposal["signal"],
    branchKey: string,
    evidence: ReadonlyArray<ClosedDecision>,
    widens: boolean,
    anchor: string,
): LearnedProposal => ({
    signal,
    branchKey,
    widens,
    evidence: evidence.map((decision) => decision.id),
    dedupeKey: `learned:${signal}:${branchKey}:${anchor}`,
})

/** The run of approved decisions at the end of the branch's history, broken by anything else. */
const trailingRun = (history: ReadonlyArray<ClosedDecision>): ReadonlyArray<ClosedDecision> => {
    const index = history.findLastIndex((decision) => !trusted(decision))
    return history.slice(index + 1)
}

const signalsOf = (history: ReadonlyArray<ClosedDecision>, branchKey: string): ReadonlyArray<LearnedProposal> => {
    const run = trailingRun(history)
    const recent = history.slice(-WINDOW)
    const rejected = recent.filter(disliked)
    const expired = recent.filter((decision) => decision.closedAs === "expired")
    return [
        ...(run.length >= TRUST_THRESHOLD ? [proposal("trust", branchKey, run.slice(-TRUST_THRESHOLD), true, run[0]?.id ?? "")] : []),
        ...(rejected.length >= REJECT_HITS ? [proposal("reject", branchKey, rejected, false, rejected.at(-1)?.id ?? "")] : []),
        ...(expired.length >= TIMEOUT_HITS ? [proposal("timeout", branchKey, expired, false, expired.at(-1)?.id ?? "")] : []),
    ]
}

/**
 * What the closed decisions of a graph teach, by code and with no model. Twenty approvals in a row, none edited, raise a
 * boundary proposal that widens rights; five rejected or edited of the last ten propose a lower boundary; three expired of the last
 * ten propose a backup. Below a threshold nothing is proposed. The dedupe key names the signal, the branch and the last decision
 * of the evidence, so (for a streak, anchored on its first decision) the same streak never raises the same proposal twice.
 */
export const learnSignals = (decisions: ReadonlyArray<ClosedDecision>): ReadonlyArray<LearnedProposal> => {
    const branches = [...new Set(decisions.map((decision) => decision.branchKey))]
    return branches.flatMap((branchKey) => signalsOf(ofBranch(decisions, branchKey), branchKey))
}

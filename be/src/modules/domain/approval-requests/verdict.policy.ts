import type { ApprovalPolicy } from "@modules/domain/authority-rules"
import type { ApproverRef } from "@modules/domain/member-grants"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { ApprovalOutcome, ApprovalVerdict, GivenVerdict } from "./approval-requests.contracts"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"

/** What one verdict reads: how the group decides, who may answer now, what was answered, and the new answer. */
export interface VerdictInput {
    /** How the approvers decide. */
    readonly policy: ApprovalPolicy
    /** The approvers right now (the live group the grants cover), in the order a sequential policy asks them. */
    readonly eligible: ReadonlyArray<ApproverRef>
    /** The verdicts given before this one. */
    readonly given: ReadonlyArray<GivenVerdict>
    /** The member who answers now; the caller proved they are in `eligible`. */
    readonly memberId: string
    /** What they answer. */
    readonly verdict: ApprovalVerdict
}

/** What a verdict does to the request: it settles it, or it is recorded and more answers are awaited from `remaining`. */
export type VerdictResult =
    | { readonly settled: true; readonly outcome: Exclude<ApprovalOutcome, "expired"> }
    | { readonly settled: false; readonly remaining: ReadonlyArray<ApproverRef> }

const outcomeOf = (verdict: ApprovalVerdict): "approved" | "rejected" =>
    verdict === "approve" ? "approved" : "rejected"

/** The members who have approved: before, and the member whose approval is being given now (only an approval reaches here). */
const approvedIds = (input: VerdictInput): ReadonlySet<string> =>
    new Set([...input.given.filter((one) => one.verdict === "approve").map((one) => one.memberId), input.memberId])

/** The approvers who have not answered, counting the answer now given. */
const unanswered = (input: VerdictInput): ReadonlyArray<ApproverRef> => {
    const answered = new Set([...input.given.map((one) => one.memberId), input.memberId])
    return input.eligible.filter((member) => !answered.has(member.memberId))
}

const approveAll = (input: VerdictInput): VerdictResult => {
    const approved = approvedIds(input)
    const remaining = input.eligible.filter((member) => !approved.has(member.memberId))
    return remaining.length === 0 ? { settled: true, outcome: "approved" } : { settled: false, remaining }
}

const approveInOrder = (input: VerdictInput): VerdictResult => {
    const remaining = unanswered(input)
    return remaining.length === 0 ? { settled: true, outcome: "approved" } : { settled: false, remaining }
}

/** The approver whose turn it is under a sequential policy: the first of the group who has not answered. */
const nextInOrder = (input: VerdictInput): ApproverRef | undefined => {
    const answered = new Set(input.given.map((one) => one.memberId))
    return input.eligible.find((member) => !answered.has(member.memberId))
}

/**
 * The effect of one verdict, by policy. "any": the first answer settles the request. "all": one rejection settles it as rejected;
 * it is approved when every approver of the group right now has approved (a member who lost their grant no longer has to answer).
 * "sequential": the approvers answer in order, only the next one may answer, a rejection settles it as rejected and it is approved
 * after the last one approves. A member who already answered may not answer twice.
 */
export const judgeVerdict = (input: VerdictInput): Outcome<VerdictResult, ApprovalRequestsErrorCode> => {
    if (input.given.some((one) => one.memberId === input.memberId)) {
        return refused(ApprovalRequestsErrorCode.AlreadyDecided)
    }
    const next = input.policy === "sequential" ? nextInOrder(input) : undefined
    if (next !== undefined && next.memberId !== input.memberId) {
        return refused(ApprovalRequestsErrorCode.NotYourTurn, { name: next.name })
    }
    if (input.policy === "any" || input.verdict === "reject") {
        return ok({ settled: true, outcome: outcomeOf(input.verdict) })
    }
    return ok(input.policy === "all" ? approveAll(input) : approveInOrder(input))
}

/** The time of day a request was settled at, as the loser of the race reads it: hours and minutes in Vietnam time. */
export const timeOfDay = (iso: string): string =>
    new Date(iso).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    })

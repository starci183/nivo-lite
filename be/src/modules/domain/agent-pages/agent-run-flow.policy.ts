import { AgentWorkError, AgentWorkErrorCode } from "@modules/domain/agent-work"
import type { ApprovalVerdictOutcome } from "@modules/domain/agent-threads"
import type { Locale } from "@modules/platform/i18n"
import type { RunFlowPayload } from "./agent-run-flow.contracts"

/** The roles that decide a permission request; the thread approvals' door then lets only the owner approve. */
const DECIDERS: ReadonlySet<string> = new Set(["owner", "manager"])

const invalid = (field: string): AgentWorkError =>
    new AgentWorkError({ code: AgentWorkErrorCode.ApprovalPayloadInvalid, params: { field } })

/** The inputs of a command as a plain record. */
export const payloadOf = (payload: object): RunFlowPayload => Object.fromEntries(Object.entries(payload))

/** Whether a role may decide a permission request. */
export const mayDecide = (role: string): boolean => DECIDERS.has(role)

/** The id of the work item, under either spelling the callers send; the first present wins. */
export const workItemIdOf = (payload: RunFlowPayload): string => {
    const value = payload["workItemId"] ?? payload["work_item_id"]
    if (typeof value !== "string") throw invalid("workItemId")
    return value
}

/** The verdict: `approved` or `rejected`, nothing else. */
export const approvesOf = (payload: RunFlowPayload): boolean => {
    const value = payload["decision"]
    if (value !== "approved" && value !== "rejected") throw invalid("decision")
    return value === "approved"
}

/** English only when it is named. */
export const localeOf = (payload: RunFlowPayload): Locale => (payload["locale"] === "en" ? "en" : "vi")

/** The typed error of the approvals' door refusing a verdict. */
export const refusalOf = (outcome: Extract<ApprovalVerdictOutcome, { kind: "refused" }>): AgentWorkError => {
    if (outcome.code === "not_found") return new AgentWorkError({ code: AgentWorkErrorCode.ApprovalNotFound })
    if (outcome.code === "not_owner") return new AgentWorkError({ code: AgentWorkErrorCode.ApprovalNotOwner })
    return new AgentWorkError({ code: AgentWorkErrorCode.ApprovalNotWaiting })
}

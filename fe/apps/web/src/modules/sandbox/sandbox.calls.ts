import type { SandboxCallsQuery } from "@/modules/api"
import type { SandboxCallRowView, SandboxCallsData } from "@/modules/types"
import { SANDBOX_JOIN, type SandboxWords } from "./sandbox.words"

/** How many lines of the call log a page draws, and how many more a press adds. */
export const CALLS_PAGE = 10

/** The case a logged request names (a send carries its case id in the request), else nothing. */
const caseIdOf = (requestJson: string): string | null => {
    try {
        const parsed: unknown = JSON.parse(requestJson)
        if (typeof parsed === "object" && parsed !== null && "caseId" in parsed && typeof parsed.caseId === "string") {
            return parsed.caseId
        }
    } catch {
        return null
    }
    return null
}

/** One line of the call log: what was called, which case or key, when and, when it threw, why. */
const callRowOf = (call: SandboxCallsQuery["sandboxCalls"][number], words: SandboxWords): SandboxCallRowView => {
    const isFailed = call.outcome === "threw"
    const what = caseIdOf(call.requestJson) ?? call.key
    return {
        id: call.id,
        title: call.operation === "inbound" ? words.inbound : call.operation,
        line: [what, words.time(call.at), isFailed ? (call.error ?? "") : ""]
            .filter((part) => part !== "")
            .join(SANDBOX_JOIN),
        isFailed,
    }
}

/** The call log, newest first, cut to what is drawn (the back end answers oldest first, at most 500). */
export const callsDataOf = (
    calls: SandboxCallsQuery["sandboxCalls"],
    shown: number,
    words: SandboxWords,
): SandboxCallsData => {
    const newest = [...calls].reverse()
    return { rows: newest.slice(0, shown).map((call) => callRowOf(call, words)), hasMore: newest.length > shown }
}

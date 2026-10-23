import { ASSIGNMENT_TEXT_MAX, ASSIGNMENT_TITLE_MAX } from "./agent-profile.contracts"
import type { AssignRequest, AssignmentTask } from "./agent-profile.contracts"

const ELLIPSIS = String.fromCodePoint(0x2026)

/** The request as it is kept: trimmed. */
export const requestTextOf = (text: string): string => text.trim()

/** Whether a trimmed request is one a person may hand an agent: not empty and not longer than allowed. */
export const isAssignableText = (text: string): boolean => text.length > 0 && text.length <= ASSIGNMENT_TEXT_MAX

/** The title of the thread an assignment opens: the first line of the request, clipped. */
export const threadTitleOf = (text: string): string => {
    const [firstLine = ""] = text.split(/\r?\n/u)
    const line = firstLine.trim()
    return line.length <= ASSIGNMENT_TITLE_MAX
        ? line
        : `${line.slice(0, ASSIGNMENT_TITLE_MAX - 1).trimEnd()}${ELLIPSIS}`
}

/** The structured work of a request: an action with the customer it is about; null when the request names no action or no customer. */
export const taskOf = (request: AssignRequest): AssignmentTask | null =>
    typeof request.action === "string" && typeof request.leadId === "string"
        ? {
              action: request.action,
              amount: request.amount ?? null,
              amountVnd: request.amountVnd ?? null,
              leadId: request.leadId,
          }
        : null

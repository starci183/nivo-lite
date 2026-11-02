import { REQUEST_RESULT, agentRequestSchema } from "@modules/domain/intent-contracts"
import { parseJsonText } from "@modules/platform/primitives"

/** Converts a validated single-action contract result to the settler's proposal; unreadable request rows never act. */
export const requestProposalTextOf = (resultKind: string, text: string, intent: string): string | null => {
    if (resultKind !== REQUEST_RESULT) return text
    const read = parseJsonText(text)
    if (!read.ok) return null
    const parsed = agentRequestSchema.safeParse(read.value)
    if (!parsed.success) return null
    if (parsed.data.action !== intent) return null
    const { action, subject, leadId, fields, summary, ...proposal } = parsed.data
    return JSON.stringify({
        ...proposal,
        actions: [{ action, subject, leadId, fields, summary }],
    })
}

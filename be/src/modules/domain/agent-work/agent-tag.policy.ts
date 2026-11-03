import type { AgentTagRequest } from "./agent-tag.contracts"
import type { AgentWakeContext } from "./agent-work.contracts"

/** The most characters of the tagger's words a wake keeps. */
export const TAG_TEXT_MAX = 2000

/** The most characters of a source name or a subject a wake keeps. */
const TAG_LABEL_MAX = 200

/** The most characters of the plain data a tag hands over, as JSON text. */
export const TAG_CONTEXT_MAX = 8000

/** The plain data of a tag as JSON text, or null when there is none or it is larger than a wake keeps. */
export const tagPayloadTextOf = (request: AgentTagRequest): string | null | undefined => {
    if (request.context === undefined) return undefined
    const text = JSON.stringify(request.context)
    return text.length > TAG_CONTEXT_MAX ? null : text
}

/** The plain data a tag wake carries, or an empty object when it carries none. */
export const tagPayloadOf = (context: AgentWakeContext): Readonly<Record<string, unknown>> => {
    if (context.tagContext === undefined) return {}
    const parsed: unknown = JSON.parse(context.tagContext)
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? Object.fromEntries(Object.entries(parsed))
        : {}
}

/** The context a tag wake carries: the trigger fields (text, subject, conversation) and who or what tagged. */
export const tagContextOf = (request: AgentTagRequest, payload?: string): AgentWakeContext => ({
    text: request.text.slice(0, TAG_TEXT_MAX),
    ...(payload === undefined ? {} : { tagContext: payload }),
    ...(request.subject == null ? {} : { subject: request.subject.slice(0, TAG_LABEL_MAX) }),
    ...(request.conversationId == null ? {} : { conversationId: request.conversationId }),
    ...("fromAgentId" in request ? { fromAgentId: request.fromAgentId } : {}),
    ...("source" in request ? { tagSource: request.source.slice(0, TAG_LABEL_MAX) } : {}),
})

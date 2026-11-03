import type { AgentTagRequest } from "./agent-tag.contracts"
import type { AgentWakeContext } from "./agent-work.contracts"

/** The most characters of the tagger's words a wake keeps. */
export const TAG_TEXT_MAX = 2000

/** The most characters of a source name or a subject a wake keeps. */
const TAG_LABEL_MAX = 200

/** The context a tag wake carries: the trigger fields (text, subject, conversation) and who or what tagged. */
export const tagContextOf = (request: AgentTagRequest): AgentWakeContext => ({
    text: request.text.slice(0, TAG_TEXT_MAX),
    ...(request.subject == null ? {} : { subject: request.subject.slice(0, TAG_LABEL_MAX) }),
    ...(request.conversationId == null ? {} : { conversationId: request.conversationId }),
    ...("fromAgentId" in request ? { fromAgentId: request.fromAgentId } : {}),
    ...("source" in request ? { tagSource: request.source.slice(0, TAG_LABEL_MAX) } : {}),
})

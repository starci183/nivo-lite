import type { WorkItem } from "@modules/domain/decisions"
import { isManagerRole } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { OptionalChatConversationId } from "./chatreply.contracts"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"

/** Bounds the trimmed body again at the service seam, including calls outside GraphQL. */
export const replyBody = (value: string): string => {
    const body = value.trim()
    if (body.length === 0 || body.length > 4000) throw new ChatreplyError({ code: ChatreplyErrorCode.InvalidBody })
    return body
}

/** Managers may reassign a held conversation; staff act only when it is free or held by them. */
export const requireHandlingAccess = (member: WorkspaceMember, holder: string | null): void => {
    if (holder !== null && holder !== "OpenClaw" && holder !== member.displayName && !isManagerRole(member.role)) {
        throw new ChatreplyError({ code: ChatreplyErrorCode.HeldByOther })
    }
}

/** The escalation conversation: explicit field first, then a legacy conversation subject. */
export const answerConversationId = (item: WorkItem): OptionalChatConversationId => {
    const field = item.proposal.fields.conversation_id
    if (typeof field === "string" && field !== "") return field
    return item.subject_type === "conversation" ? item.subject_id : null
}

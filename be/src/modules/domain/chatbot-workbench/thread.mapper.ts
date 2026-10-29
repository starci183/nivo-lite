import { isoOf } from "@modules/domain/brain-facts"
import type { ChatbotLead, ChatbotMessage, ChatbotThread } from "./chatbot-workbench.contracts"
import { roleOf, toConversation, waitingConversationId } from "./conversation.policy"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { ChatThreadLine } from "@modules/domain/agent-messages"
import type { LeadRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

/** The authorized records of one customer thread. */
export interface ThreadRecords {
    /** The workspace-scoped customer conversation. */
    readonly conversation: CustomerConversationRow
    /** The conversation lines in creation order. */
    readonly messages: ReadonlyArray<ChatThreadLine>
    /** The open customer-reply escalations. */
    readonly waiting: ReadonlyArray<WaitingRow>
    /** The linked lead, when present in the workspace. */
    readonly lead: LeadRow | null
    /** The assigned staff display name, when assigned. */
    readonly staffName: string | null
}

const toMessage = (row: ChatThreadLine): ChatbotMessage => ({
    id: row.id,
    role: roleOf(row.role),
    authorKind: row.author_kind === "human" ? "human" : "ai",
    authorName: row.author_name,
    body: row.body,
    createdAt: isoOf(row.created_at),
    delivery: row.delivery_status === "sent" || row.delivery_status === "failed" ? row.delivery_status : null,
    deliveryError: row.delivery_error,
})

const toLead = (row: LeadRow): ChatbotLead => ({
    id: row.id,
    name: row.contact_name,
    company: row.company,
    stage: row.stage,
    need: row.need,
    phone: row.phone,
    email: row.email,
})

const proposalText = (proposal: WaitingRow["proposal"], key: "summary" | "draft"): string => {
    const value = proposal?.[key]
    return typeof value === "string" ? value : ""
}

const proposalQuestion = (proposal: WaitingRow["proposal"]): string => {
    const fields = proposal?.fields
    if (typeof fields === "object" && fields !== null && !Array.isArray(fields) && "question" in fields) {
        return typeof fields.question === "string" ? fields.question : proposalText(proposal, "summary")
    }
    return proposalText(proposal, "summary")
}

/** One thread with normalized messages, customer facts and the first open escalation. */
export const buildChatbotThread = (records: ThreadRecords): ChatbotThread => {
    const conversation = records.conversation
    const item = records.waiting.find((work) => waitingConversationId(work) === conversation.id) ?? null
    return {
        conversation: toConversation(conversation, records.messages, records.lead?.contact_name, item !== null),
        messages: records.messages.map(toMessage),
        lead: records.lead === null ? null : toLead(records.lead),
        escalation:
            item === null
                ? null
                : {
                      workItemId: item.id,
                      question: proposalQuestion(item.proposal),
                      draft: proposalText(item.proposal, "draft"),
                      staffName: records.staffName,
                      since: isoOf(item.created_at),
                  },
        externalId: conversation.external_id,
        handledAt: conversation.handled_at === null ? null : isoOf(conversation.handled_at),
    }
}

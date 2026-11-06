import { isoOf } from "@modules/domain/brain-facts"
import type { ChatbotMessage, ChatbotThread } from "./chatbot-workbench.contracts"
import {
    proposalDraft,
    proposalQuestion,
    respondentOf,
    roleOf,
    toConversation,
    waitingConversationId,
} from "./conversation.policy"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { ChatThreadLine } from "@modules/domain/agent-messages"
import { filesOfMessage } from "@modules/domain/chat-files"
import type { ChatFileView } from "@modules/domain/chat-files"
import type { WaitingRow } from "./persistence/chatbot-workbench.rows"

/** The authorized records of one customer thread. */
export interface ThreadRecords {
    /** The workspace-scoped customer conversation. */
    readonly conversation: CustomerConversationRow
    /** The conversation lines in creation order. */
    readonly messages: ReadonlyArray<ChatThreadLine>
    /** The files of those lines. */
    readonly files: ReadonlyArray<ChatFileView>
    /** The open customer-reply escalations. */
    readonly waiting: ReadonlyArray<WaitingRow>
    /** The assigned staff display name, when assigned. */
    readonly staffName: string | null
    /** The names of the agents that speak in the conversation, by agent id. */
    readonly agentNames: ReadonlyMap<string, string>
}

const toMessage = (row: ChatThreadLine, files: ReadonlyArray<ChatFileView>): ChatbotMessage => ({
    id: row.id,
    role: roleOf(row.role),
    authorKind: row.author_kind === "human" ? "human" : "ai",
    authorName: row.author_name,
    body: row.body,
    createdAt: isoOf(row.created_at),
    delivery: row.delivery_status === "sent" || row.delivery_status === "failed" ? row.delivery_status : null,
    deliveryError: row.delivery_error,
    files: filesOfMessage(files, row.id),
})

/** One thread with normalized messages and the first open escalation. */
export const buildChatbotThread = (records: ThreadRecords): ChatbotThread => {
    const conversation = records.conversation
    const item = records.waiting.find((work) => waitingConversationId(work) === conversation.id) ?? null
    return {
        conversation: toConversation(
            conversation,
            records.messages,
            item !== null,
            respondentOf(conversation, new Set(), records.agentNames),
        ),
        messages: records.messages.map((row) => toMessage(row, records.files)),
        escalation:
            item === null
                ? null
                : {
                      workItemId: item.id,
                      question: proposalQuestion(item.proposal),
                      draft: proposalDraft(item.proposal),
                      staffName: records.staffName,
                      since: isoOf(item.created_at),
                  },
        externalId: conversation.external_id,
        handledAt: conversation.handled_at === null ? null : isoOf(conversation.handled_at),
    }
}

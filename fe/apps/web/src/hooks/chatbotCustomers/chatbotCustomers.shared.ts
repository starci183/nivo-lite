import {
    CHATBOT_CUSTOMER_FILTERS as CUSTOMER_FILTERS,
    type CustomerFilter,
    type CustomerRowView,
    type ChatbotConversation,
} from "@/modules/types"
export { CUSTOMER_FILTERS }
export type { CustomerFilter, CustomerRowView } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import { leadStageLabel } from "@/modules/utils"
import { chatChannelLabelOf, dayKeyOf, type ChatbotTranslator } from "@/hooks/chatbot"
/** The newest conversations the overview carries; a list this long may hide older customers. */
export const CUSTOMERS_FETCHED = 200
/** The existing customer-row geometry before the overview has answered. */
export const CHATBOT_CUSTOMERS_PLACEHOLDER: ReadonlyArray<CustomerRowView> = [
    { id: "loading", href: "", name: "", summary: "", stage: null, status: { label: "", tone: "neutral" } },
]
const FILTER_IDS: ReadonlySet<string> = new Set(CUSTOMER_FILTERS)
const FILTER_KEYS: Readonly<Record<CustomerFilter, string>> = {
    all: "filterAll",
    needs: "filterNeedsPerson",
    progress: "filterInProgress",
    today: "filterToday",
}
/** The label of a filter chip. */
export const customerFilterLabelOf = (t: ChatbotTranslator, filter: CustomerFilter): string => t(FILTER_KEYS[filter])
/** Whether a stored filter id is one of the four. */
export const isCustomerFilter = (value: string): value is CustomerFilter => FILTER_IDS.has(value)
const isOpen = (conversation: ChatbotConversation): boolean =>
    conversation.lead !== null && conversation.lead.stage !== "won" && conversation.lead.stage !== "lost"
/** Whether a conversation passes the chip: a person is needed, the deal is still open, or it moved today. */
export const matchesCustomerFilter = (
    conversation: ChatbotConversation,
    filter: CustomerFilter,
    nowIso: string,
): boolean => {
    if (filter === "needs") return conversation.waiting || conversation.unanswered
    if (filter === "progress") return isOpen(conversation)
    if (filter === "today") return dayKeyOf(conversation.lastAt) === dayKeyOf(nowIso)
    return true
}
/** Whether the typed words appear in the customer's name, company or need. */
export const matchesCustomerQuery = (conversation: ChatbotConversation, query: string): boolean => {
    const words = query.trim().toLowerCase()
    if (words === "") return true
    const text = [conversation.name, conversation.lead?.company ?? "", conversation.lead?.need ?? conversation.lastText]
    return text.some((part) => part.toLowerCase().includes(words))
}
/** Where a conversation stands, as one badge: a customer awaited, a person in it, another agent, or the AI answering. */
export const statusOf = (
    t: ChatbotTranslator,
    conversation: ChatbotConversation,
): {
    readonly label: string
    readonly tone: BadgeTone
} => {
    if (conversation.waiting) return { label: t("chipWaiting"), tone: "warning" }
    if (conversation.unanswered) return { label: t("chipUnanswered"), tone: "warning" }
    const respondent = conversation.respondent
    if (respondent.kind === "ai") return { label: t("chipAi"), tone: "success" }
    if (respondent.kind === "person") return { label: t("chipHandled", { name: respondent.name }), tone: "accent" }
    return { label: t("replyingAgent", { name: respondent.name }), tone: "accent" }
}
/** The rows of the Customers list: the conversations that pass the chip and the search, as the table reads them. */
export const customerRowsOf = (
    t: ChatbotTranslator,
    conversations: ReadonlyArray<ChatbotConversation>,
    filter: CustomerFilter,
    query: string,
    nowIso: string,
    hrefOf: (conversationId: string) => string,
): ReadonlyArray<CustomerRowView> =>
    conversations
        .filter((conversation) => matchesCustomerFilter(conversation, filter, nowIso))
        .filter((conversation) => matchesCustomerQuery(conversation, query))
        .map((conversation) => ({
            id: conversation.id,
            href: hrefOf(conversation.id),
            name: conversation.name === "" ? t("unknownCustomer") : conversation.name,
            summary: [
                chatChannelLabelOf(t, conversation.channel),
                conversation.lead?.company ?? "",
                conversation.lead?.need ?? conversation.lastText,
            ]
                .filter((part) => part !== "")
                .join(" · "),
            stage: conversation.lead === null ? null : leadStageLabel(t, conversation.lead.stage),
            status: statusOf(t, conversation),
        }))

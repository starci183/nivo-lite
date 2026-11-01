import type { ChatbotConversation, ChatbotRespondent } from "@/modules/types"
import { leadStageLabel } from "@/modules/utils"
import { chatChannelLabelOf, dayKeyOf } from "@/hooks/chatbot"
import type { ChatbotTranslator } from "@/hooks/chatbot"

/** The ways the Customers tab narrows its list. */
export const CUSTOMER_FILTERS = ["all", "needs", "progress", "today"] as const

/** One way of narrowing the Customers tab. */
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number]

/** The newest conversations the overview carries; a list this long may hide older customers. */
export const CUSTOMERS_FETCHED = 200

/** One customer as a row of the table reads it, already worded. */
export interface CustomerRowView {
    readonly id: string
    /** The conversation the row opens in the inbox. */
    readonly href: string
    readonly name: string
    readonly company: string
    readonly channel: string
    readonly stage: string
    readonly need: string
    readonly replying: string
}

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
    const text = [conversation.name, conversation.lead?.company ?? "", conversation.lead?.need ?? ""]
    return text.some((part) => part.toLowerCase().includes(words))
}

/** Who answers next, in a few words. */
export const respondentTextOf = (t: ChatbotTranslator, respondent: ChatbotRespondent): string => {
    if (respondent.kind === "person") return t("replyingPerson", { name: respondent.name })
    if (respondent.kind === "agent") return t("replyingAgent", { name: respondent.name })
    return t("replyingAi")
}

/** The rows of the Customers table: the conversations that pass the chip and the search, as the table reads them. */
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
            company: conversation.lead?.company ?? "",
            channel: chatChannelLabelOf(t, conversation.channel),
            stage: conversation.lead === null ? "-" : leadStageLabel(t, conversation.lead.stage),
            need: conversation.lead?.need ?? "-",
            replying: respondentTextOf(t, conversation.respondent),
        }))

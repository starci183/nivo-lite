import { leadStageSteps } from "@/modules/utils"
import {
    INBOX_FILTERS,
    chatChannelLabelOf,
    channelLineOf,
    chipsOf,
    composerHintOf,
    filterLabelOf,
    handlingTextOf,
    leadFactsOf,
    listTimeOf,
    type ChatbotFormat,
    type ChatbotTranslator,
    type InboxFilter,
    type ChatbotChipView,
} from "@/hooks/chatbot"
import { threadEntriesOf, type ChatbotThreadEntry } from "@/hooks/chatbotThread"
import { leadHref } from "@/modules/routes"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread, LeadStageId } from "@/modules/types"

/** The existing unread inbox overview keeps its real words and draws no conversation rows. */
export const CHATBOT_EMPTY_OVERVIEW: ChatbotOverview = {
    workspaceId: "",
    nowIso: new Date(0).toISOString(),
    conversations: [],
    metrics: { today: 0, waiting: 0, p50FirstResponseMin: null, sample: 0, leadsCaptured7d: 0 },
    waiting: [],
}

/** What the conversation list shows. */
export interface ListViewInput {
    readonly visible: ReadonlyArray<ChatbotConversation>
    readonly total: number
    readonly nowIso: string
    readonly query: string
    readonly filter: InboxFilter
    readonly selectedId: string | null
}

/** The preview line of a row: the last text, led by "You" when the agent wrote it. */
const previewOf = (t: ChatbotTranslator, item: ChatbotConversation): string => {
    if (item.lastText === "") return t("noMessages")
    return item.lastRole === "agent" ? `${t("youPrefix")}: ${item.lastText}` : item.lastText
}

/** What `listViewOf` returns. */
export interface ListViewOfResult {
    title: string
    searchLabel: string
    searchPlaceholder: string
    clearLabel: string
    listLabel: string
    query: string
    filters: {
        value: InboxFilter
        label: string
    }[]
    selectedFilter: InboxFilter
    items: {
        id: string
        name: string
        preview: string
        time: string
        channel: string
        chips: readonly ChatbotChipView[]
    }[]
    hasConversations: boolean
    emptyListTitle: string
    emptyListBody: string
    emptyFilter: string
    selectedId: string | null
}

/** The words and rows of the conversation list. */
export const listViewOf = (t: ChatbotTranslator, format: ChatbotFormat, input: ListViewInput): ListViewOfResult => ({
    title: t("title"),
    searchLabel: t("searchLabel"),
    searchPlaceholder: t("searchPlaceholder"),
    clearLabel: t("clearSearch"),
    listLabel: t("listLabel"),
    query: input.query,
    filters: INBOX_FILTERS.map((filter) => ({ value: filter, label: filterLabelOf(t, filter) })),
    selectedFilter: input.filter,
    items: input.visible.map((item) => ({
        id: item.id,
        name: item.name || t("unknownCustomer"),
        preview: previewOf(t, item),
        time: listTimeOf(t, format, item.lastAt, input.nowIso),
        channel: chatChannelLabelOf(t, item.channel),
        chips: chipsOf(t, item),
    })),
    hasConversations: input.total > 0,
    emptyListTitle: t("emptyListTitle"),
    emptyListBody: t("emptyListBody"),
    emptyFilter: t("emptyFilter"),
    selectedId: input.selectedId,
})

/** What the open thread shows. */
export interface ThreadViewInput {
    readonly thread: ChatbotThread | null
    readonly isResolving: boolean
    readonly name: string
    readonly nowIso: string
    readonly userName: string
    readonly isInfoOpen: boolean
    readonly draft: string
    readonly error: string | null
    readonly isSending: boolean
}

/** What `threadViewOf` returns. */
export interface ThreadViewOfResult {
    isResolving: boolean
    hasThread: boolean
    pickBody: string
    backLabel: string
    infoLabel: string
    isInfoOpen: boolean
    name: string
    channel: string
    chips: readonly ChatbotChipView[]
    entries: readonly ChatbotThreadEntry[]
    canReply: boolean
    lockedText: string
    composerLabel: string
    composerPlaceholder: string
    composerHint: string
    sendLabel: string
    draft: string
    notSentTitle: string
    error: string | null
    isSending: boolean
}

/** The words and entries of the open thread and its composer. */
export const threadViewOf = (
    t: ChatbotTranslator,
    format: ChatbotFormat,
    input: ThreadViewInput,
): ThreadViewOfResult => {
    const conversation = input.thread?.conversation ?? null
    const handledBy = conversation?.handledBy ?? null
    return {
        isResolving: input.isResolving,
        hasThread: input.thread !== null,
        pickBody: t("pickBody"),
        backLabel: t("back"),
        infoLabel: input.isInfoOpen ? t("infoClose") : t("infoOpen"),
        isInfoOpen: input.isInfoOpen,
        name: input.name,
        channel: conversation === null ? "" : chatChannelLabelOf(t, conversation.channel),
        chips: conversation === null ? [] : chipsOf(t, conversation),
        entries: input.thread === null ? [] : threadEntriesOf(t, format, input.thread, input.name, input.nowIso),
        canReply: handledBy !== null && handledBy === input.userName,
        lockedText: handledBy === null ? t("composerLocked") : t("composerLockedOther", { name: handledBy }),
        composerLabel: t("composerLabel"),
        composerPlaceholder: t("composerPlaceholder"),
        composerHint: conversation === null ? "" : composerHintOf(t, conversation.channel, input.userName),
        sendLabel: t("send"),
        draft: input.draft,
        notSentTitle: t("notSent"),
        error: input.error,
        isSending: input.isSending,
    }
}

/** What the customer pane shows. */
export interface SideViewInput {
    readonly thread: ChatbotThread | null
    readonly name: string
    readonly userName: string
    readonly answerDraft: string
    readonly answerFailure: string | null
    readonly busy: "reply" | "answer" | "handling" | null
}

/** What `sideViewOf` returns. */
export interface SideViewOfResult {
    title: string
    closeLabel: string
    hasThread: boolean
    customerName: string
    channelLine: string
    escalation: {
        title: string
        askedLabel: string
        question: string
        assigned: string | null
        draftLabel: string
        draftHint: string
        draft: string
        sendLabel: string
        declineLabel: string
        isAnswering: boolean
        noticeTone: "negative" | null
        noticeTitle: string
        noticeText: string | null
    } | null
    stage: {
        title: string
        label: string
        steps: readonly {
            readonly id: LeadStageId
            readonly label: string
        }[]
        currentId: LeadStageId
    } | null
    handling: {
        title: string
        text: string
        buttonLabel: string
        hint: string | null
        isBusy: boolean
    }
    leadTitle: string
    leadNone: string
    lead: {
        name: string
        facts: readonly {
            readonly id: string
            readonly term: string
            readonly description: string
        }[]
        openLabel: string
        openHref: string
    } | null
}

/** The words and parts of the customer pane. */
export const sideViewOf = (t: ChatbotTranslator, input: SideViewInput): SideViewOfResult => {
    const conversation = input.thread?.conversation ?? null
    const escalation = input.thread?.escalation ?? null
    const lead = input.thread?.lead ?? null
    const handledBy = conversation?.handledBy ?? null
    const stageLead = conversation?.lead ?? null
    return {
        title: t("customerTitle"),
        closeLabel: t("infoClose"),
        hasThread: input.thread !== null,
        customerName: input.name,
        channelLine: conversation === null ? "" : channelLineOf(t, conversation.channel),
        escalation:
            escalation === null
                ? null
                : {
                      title: t("escalationTitle"),
                      askedLabel: t("escalationAsked"),
                      question: escalation.question,
                      assigned:
                          escalation.staffName === null
                              ? null
                              : t("escalationAssigned", { name: escalation.staffName }),
                      draftLabel: t("escalationDraft"),
                      draftHint: t("escalationDraftHint", { name: input.userName }),
                      draft: input.answerDraft,
                      sendLabel: t("escalationSend"),
                      declineLabel: t("escalationDecline"),
                      isAnswering: input.busy !== null,
                      noticeTone: input.answerFailure === null ? null : ("negative" as const),
                      noticeTitle: t("notSent"),
                      noticeText: input.answerFailure,
                  },
        stage:
            stageLead === null
                ? null
                : {
                      title: t("stageTitle"),
                      label: t("stageStepperLabel"),
                      steps: leadStageSteps(t),
                      currentId: stageLead.stage,
                  },
        handling: {
            title: t("handlingTitle"),
            text:
                handledBy === null && conversation?.respondent.kind === "agent"
                    ? t("handlingAgent", { name: conversation.respondent.name })
                    : handlingTextOf(t, handledBy, input.userName),
            buttonLabel: handledBy === null ? t("takeOver") : t("handBack"),
            hint: handledBy === null ? t("takeOverHint") : null,
            isBusy: input.busy !== null,
        },
        leadTitle: t("leadTitle"),
        leadNone: t("leadNone"),
        lead:
            lead === null
                ? null
                : {
                      name: lead.name,
                      facts: leadFactsOf(t, lead),
                      openLabel: t("leadOpen"),
                      openHref: leadHref(lead.id),
                  },
    }
}

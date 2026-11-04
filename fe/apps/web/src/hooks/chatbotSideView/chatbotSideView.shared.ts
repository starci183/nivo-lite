import { leadStageSteps } from "@/modules/utils"
import { channelLineOf, handlingTextOf, leadFactsOf, type ChatbotTranslator } from "@/hooks/chatbot"
import { leadHref } from "@/modules/routes"
import type { ChatbotThread, LeadStageId } from "@/modules/types"

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

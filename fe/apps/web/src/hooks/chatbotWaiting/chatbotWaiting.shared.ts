import { chatChannelLabelOf } from "@/hooks/chatbot"
import type { ChatbotTranslator } from "@/hooks/chatbot"
import type { ChatbotWaitingReply, WorkbenchRowView } from "@/modules/types"

/** How many waiting replies the card lists; the rest stay in the inbox. */
export const WAITING_SHOWN = 3

/** What a person may do with a waiting reply, as the hook that owns the mutations offers it. */
export interface WaitingCommands {
    /** True while another command of this desk is in flight. */
    readonly isBusy: boolean
    readonly sendAnswer: (conversationId: string, workItemId: string, text: string | null) => Promise<void>
    readonly toggleHandling: (conversationId: string, takeOver: boolean) => Promise<void>
    /** Opens the draft of this reply for the person to change before it goes. */
    readonly edit: (item: ChatbotWaitingReply) => void
}

/**
 * One waiting reply as a decision row: what is approved (a reply to the customer), what they asked, why a person is needed, the AI's draft
 * as the proposal, a named command that sends it, a neutral edit, and a menu to take the chat over or not reply at all. A reply the AI wrote no draft for cannot be sent from here.
 */
export const waitingRowOf = (
    t: ChatbotTranslator,
    item: ChatbotWaitingReply,
    commands: WaitingCommands,
): WorkbenchRowView => ({
    id: item.workItemId,
    title: t("waitingTitleFor", { name: item.name === "" ? t("unknownCustomer") : item.name }),
    description: t("waitingAsked", { question: item.question }),
    badges: [{ label: chatChannelLabelOf(t, item.channel), tone: "neutral" }],
    reason: item.draft === "" ? t("waitingReasonNoDraft") : t("waitingReason"),
    amount: null,
    proposal: item.draft,
    trace: null,
    expiry: null,
    primary: {
        id: "send",
        label: t("waitingSend"),
        isPending: commands.isBusy,
        isDisabled: item.draft === "",
        ...(item.draft === "" ? { disabledReason: t("waitingNoDraft") } : {}),
        onPress: () => {
            void commands.sendAnswer(item.conversationId, item.workItemId, item.draft)
        },
    },
    edit: { id: "edit", label: t("waitingEdit"), onPress: () => commands.edit(item) },
    menu: [
        {
            id: "takeover",
            label: t("takeOver"),
            onPress: () => {
                void commands.toggleHandling(item.conversationId, true)
            },
        },
        {
            id: "dismiss",
            label: t("waitingDismiss"),
            isDanger: true,
            onPress: () => {
                void commands.sendAnswer(item.conversationId, item.workItemId, null)
            },
        },
    ],
    waitingFor: null,
})

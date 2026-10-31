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
}

/**
 * One waiting reply as a decision row: the customer, what they asked, the AI's draft as the proposal, one visible command that sends
 * the draft, and a menu to take the chat over or not reply at all. A reply the AI wrote no draft for cannot be sent from here.
 */
export const waitingRowOf = (
    t: ChatbotTranslator,
    item: ChatbotWaitingReply,
    commands: WaitingCommands,
): WorkbenchRowView => ({
    id: item.workItemId,
    title: item.name === "" ? t("unknownCustomer") : item.name,
    description: item.question,
    badges: [{ label: chatChannelLabelOf(t, item.channel), tone: "neutral" }],
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

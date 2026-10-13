import { PromoChatbotCard } from "@/components/blocks/PromoChatbotCard"
import { readChatbotState } from "@/modules/db/promo/read-chatbot-state"

/** The Chatbot promo row at the top of the leads board, read on the server: shown only while the workspace has no Chatbot. */
export const PromoLeadsRow = async () => {
    const chatbot = await readChatbotState()
    if (chatbot.kind !== "ok") return null
    return <PromoChatbotCard variant="row" hasChatbot={chatbot.value.hasChatbot} />
}

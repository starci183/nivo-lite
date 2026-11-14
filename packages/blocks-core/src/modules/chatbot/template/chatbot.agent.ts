import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { bilingualOf } from "../../../messages/catalog"
import { CHATBOT_MESSAGING } from "../../../nodes/chatbot/chatbot.accounts"
import { teamChatGraphOf } from "../../team-chat.graph"
import { FRONT_DESK_GRAPH_KEY, frontDeskGraph } from "./front-desk.graph"

/**
 * The Chatbot agent template: the front desk of a shop's customer conversations (primary) and its chat turn with the team. It works
 * with the messaging accounts only (census §7: zalo_oa, telegram, meta, in that order); creating the agent attaches the workspace's
 * account of each, and the front desk is hidden while none is attached (its reply steps block). The team chat needs no account.
 */
export const chatbotAgent: TemplateAgent = defineTemplateAgent({
    key: "chatbot",
    label: bilingualOf("contractAgentChatbot"),
    accounts: [...CHATBOT_MESSAGING],
    graphs: [frontDeskGraph, teamChatGraphOf("chatbot")],
    primary: FRONT_DESK_GRAPH_KEY,
})

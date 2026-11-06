import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { APPROVE_AND_SEND } from "./actions/approve-and-send.action"
import { DECIDE } from "./actions/decide.action"
import { HANDOFF } from "./actions/handoff.action"
import { REJECT_PROPOSAL } from "./actions/reject-proposal.action"
import { RELEASE } from "./actions/release.action"
import { REPLY } from "./actions/reply.action"
import { SAVE_SETTINGS } from "./actions/save-settings.action"
import { CHANNEL_COUNTS, THREAD_COUNTS } from "./reads/counts.read"
import { DECISIONS } from "./reads/decisions.read"
import { FIGURES } from "./reads/figures.read"
import { THREAD_MESSAGES } from "./reads/messages.read"
import { PROPOSALS } from "./reads/proposals.read"
import { SETTINGS_READ } from "./reads/settings.read"
import { THREAD } from "./reads/thread.read"
import { THREADS } from "./reads/threads.read"
import { CHATBOT_WORKBENCH_SPEC } from "./specs/chatbot.workbench"

/** The key of the Chatbot module: every read and action id starts with it. */
export const CHATBOT_MODULE_KEY = "chatbot"

/** The permissions of the Chatbot module: reading the inbox, replying, taking over and handing back, and managing its settings (owners and managers hold every permission of a module, so this is theirs). */
export const CHATBOT_PERMISSIONS: ReadonlyArray<string> = ["chatbot.view", "chatbot.reply", "chatbot.manage"]

/**
 * The Chatbot module: the inbox (the conversation list with search and status and channel filters, the chosen thread, the customer
 * pane) as reads, and the person side of a conversation (reply, take over, hand back) as actions. Its seed spec draws the Hop thu tab
 * from the generic blocks only. Delivery of a reply is the declared job `chatbot.deliver-reply`.
 */
export const chatbotModule: ModuleDeclaration = defineModule({
    key: CHATBOT_MODULE_KEY,
    namespace: CHATBOT_MODULE_KEY,
    permissions: CHATBOT_PERMISSIONS,
    reads: [
        THREADS,
        THREAD_COUNTS,
        CHANNEL_COUNTS,
        THREAD,
        THREAD_MESSAGES,
        FIGURES,
        DECISIONS,
        PROPOSALS,
        SETTINGS_READ,
    ],
    actions: [REPLY, HANDOFF, RELEASE, DECIDE, APPROVE_AND_SEND, REJECT_PROPOSAL, SAVE_SETTINGS],
    tools: ["chat.send"],
    specs: [CHATBOT_WORKBENCH_SPEC],
})

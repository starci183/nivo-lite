import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "../../shared/vocabulary/tool-ids"
import { CHATBOT_CONTACT_BLOCKS } from "./workbench/blocks/contact-blocks"
import { DECIDE } from "./actions/decide.action"
import { HANDOFF } from "./actions/handoff.action"
import { RELEASE } from "./actions/release.action"
import { REPLY } from "./actions/reply.action"
import { SAVE_SETTINGS } from "./actions/save-settings.action"
import { CHANNEL_COUNTS, THREAD_COUNTS } from "./reads/counts.read"
import { CONTACT_THREADS } from "./reads/contact-threads.read"
import { DECISIONS } from "./reads/decisions.read"
import { FIGURES } from "./reads/figures.read"
import { THREAD_MESSAGES } from "./reads/messages.read"
import { SETTINGS_READ } from "./reads/settings.read"
import { THREAD } from "./reads/thread.read"
import { THREADS } from "./reads/threads.read"
import { CHATBOT_WORKBENCH_SPEC } from "./workbench/specs/chatbot.workbench"

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
    agent: {
        tools: [
            TOOL.agentTag,
            TOOL.customerMessageSend,
            TOOL.teamMessagePost,
            TOOL.brainChangePropose,
        ],
        // No default abilities here: the engine derives them from the template agent (`abilitiesOfTemplateAgent`: the messaging
        // accounts it lists, ticked from what its node steps ask), for attaching and for the pre-install review alike.
    },
    permissions: CHATBOT_PERMISSIONS,
    reads: [
        THREADS,
        CONTACT_THREADS,
        THREAD_COUNTS,
        CHANNEL_COUNTS,
        THREAD,
        THREAD_MESSAGES,
        FIGURES,
        DECISIONS,
        SETTINGS_READ,
    ],
    actions: [REPLY, HANDOFF, RELEASE, DECIDE, SAVE_SETTINGS],
    tools: [TOOL.customerMessageSend],
    specs: [CHATBOT_WORKBENCH_SPEC],
    contactBlocks: CHATBOT_CONTACT_BLOCKS,
})

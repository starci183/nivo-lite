import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "../../vocabulary/tool-ids"
import { guidanceOf } from "../agent-policy"
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
    agent: {
        tools: [
            TOOL.agentTag,
            TOOL.customerMessageSend,
            TOOL.teamMessagePost,
            TOOL.brainSearch,
            TOOL.brainFactGet,
            TOOL.brainFactRelated,
            TOOL.brainChangePropose,
        ],
        abilities: {
            kinds: { messaging: { "customer.send": "auto" } },
        },
        policy: {
            limits: {},
            guidance: guidanceOf({
                vi:
                    "Chỉ trả lời khách từ thông tin công khai của tiệm; không bịa giá, chính sách, ngày hay lời hứa, không xác nhận đơn, tiền hay giao hàng. " +
                    "Tài liệu không có câu trả lời: nhắn khách một câu rằng em hỏi lại chủ tiệm rồi báo, và hỏi chủ tiệm. " +
                    "Khiếu nại: xin lỗi khách, không nhận lỗi cũng không chối lỗi, không hứa đền bù; báo đội để chủ tiệm xử lý.",
                en:
                    "Answer customers only from the shop's public information; never invent a price, policy, date or promise, never confirm an order, a payment or a delivery. " +
                    "When the documents do not answer: tell the customer in one line you will check with the shop owner, and ask the owner. " +
                    "A complaint: apologise to the customer, neither admit nor deny fault, promise no compensation; tell the team so the owner handles it.",
            }),
        },
    },
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
    tools: ["nivo.chat.send"],
    specs: [CHATBOT_WORKBENCH_SPEC],
})

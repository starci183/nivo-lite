import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { coreBlocks } from "./shared/blocks/core-blocks"
import { FLOW_F_ENTITIES } from "./shared/entities/flow-f.entities"
import { modelWordsOf } from "./shared/messages/catalog"
import { NODE_MODELS } from "./shared/models"
import { agentGuidanceOf } from "./shared/agent/agent-guidance"
import { accountingAgentMessageKinds } from "./agents/sales/ledger/agent-message-kinds"
import { salesAgentMessageKinds } from "./shared/agent-message/sales-agent-message-kinds"
import { MODULE_DECLARATIONS } from "./shared/modules/module-declarations"
import { MODULE_JOBS } from "./shared/modules/module-jobs"
import { MODULE_MESSAGES } from "./shared/modules/module-messages"
import { MODULE_SERVERS } from "./shared/modules/module-servers"
import { CHATBOT_WEBHOOK_EVENTS } from "./agents/chatbot/webhook-events"
import { SALES_SERVICES } from "./agents/sales/tools"
import { SALES_WEBHOOK_EVENTS } from "./agents/sales/webhook-events"
import { bookingAgent } from "./agents/booking/graphs/booking.agent"
import { chatbotAgent } from "./agents/chatbot/graphs/chatbot.agent"
import { contentAgent } from "./agents/content/graphs/content.agent"
import { hiringAgent } from "./agents/hiring/graphs/hiring.agent"
import { salesAgent } from "./agents/sales/graphs/sales.agent"
import { videoAgent } from "./agents/video/graphs/video.agent"
import { coreControlNodes } from "./shared/nodes/node-lists"
import { coreDataKinds } from "./shared/vocabulary/data-kinds"
import { coreEffects } from "./shared/vocabulary/effects"
import { TOOL_LABELS } from "./shared/vocabulary/tool-labels"
import { coreTools } from "./shared/vocabulary/tools"

/**
 * This package as ONE plugin of the installation: everything it declares, through the same contract a plugin package uses
 * (`definePlugin`). The installation is the array `[corePlugin, ...plugins]`, and the engine reads every declaration from that array,
 * never from this package by name. Public: every workspace sees and installs its modules. Its label is what the agents catalogue
 * shows in front of each of its agents (`Nivo-` and the agent's name, such as the accounting agent). Its agents are template agents
 * (`templateAgents`: each graph of an agent is installed as a workflow template of the agent's module, its nodes with it); its package
 * nodes are the control steps the graphs compile to.
 */
export const corePlugin: Plugin = definePlugin({
    key: "core",
    // The npm name of this package without its scope: the first part of every record type and record read it declares.
    packageName: "blocks-core",
    label: { vi: "Nivo", en: "Nivo" },
    modules: MODULE_DECLARATIONS,
    servers: MODULE_SERVERS,
    blocks: coreBlocks,
    nodes: coreControlNodes,
    effects: coreEffects,
    tools: coreTools,
    dataKinds: coreDataKinds,
    toolLabels: TOOL_LABELS,
    templateAgents: [chatbotAgent, salesAgent, hiringAgent, videoAgent, bookingAgent, contentAgent],
    nodeModels: NODE_MODELS,
    messages: MODULE_MESSAGES,
    jobs: MODULE_JOBS,
    entities: FLOW_F_ENTITIES,
    // The kinds of /chat message content its modules declare (the order and payment cards, the accounting cards): the engine checks a posted card against them.
    messageKinds: [...salesAgentMessageKinds, ...accountingAgentMessageKinds],
    webhookEvents: [...CHATBOT_WEBHOOK_EVENTS, ...SALES_WEBHOOK_EVENTS],
    services: [...SALES_SERVICES],
    guidance: agentGuidanceOf,
    words: modelWordsOf,
})

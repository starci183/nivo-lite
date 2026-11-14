import { specDocumentSchema } from "@nivo-lite/agent-sdk/spec"
import type { SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk } from "../../../../shared/platform/specs/agent-desk"
import type { DeskOfModule } from "../../../../shared/platform/specs/agent-desk"
import data from "./chatbot.workbench.json"

/** The desk of the Chatbot agent: block 6 lists its conversations, counted by `blocks-core.chatbot.api.chat.status-counts`, opening the module's own list as a page. */
export const CHATBOT_DESK: DeskOfModule = {
    dataSets: [{ set: "conversations", label: { vi: "Cuộc trò chuyện", en: "Conversations" }, countPath: "total" }],
    counts: { read: "blocks-core.chatbot.api.chat.status-counts" },
    pages: { conversations: viewNodeOf(data, "pane") },
}

/** The seed spec of the Chatbot workbench: the agent's desk first, then its own tabs, parsed once. */
export const CHATBOT_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, CHATBOT_DESK))

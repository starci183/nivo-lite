import type { ChatbotOverview } from "@/modules/types"

/** The existing unread inbox overview keeps its real words and draws no conversation rows. */
export const CHATBOT_EMPTY_OVERVIEW: ChatbotOverview = {
    workspaceId: "",
    nowIso: new Date(0).toISOString(),
    conversations: [],
    metrics: { today: 0, waiting: 0, p50FirstResponseMin: null, sample: 0, leadsCaptured7d: 0 },
    waiting: [],
}

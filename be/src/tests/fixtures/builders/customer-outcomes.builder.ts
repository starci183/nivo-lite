import type { CustomerTurn, ChatTurnProposal } from "@modules/domain/conversations"
import type { MessageCatalog } from "@modules/platform/i18n"

export const WS = "11111111-1111-4111-8111-111111111111"
export const catalog: MessageCatalog = { get: (key: string) => key }

/** A customer message turn with a configurable lead and agent knowledge for settlement cases. */
export const turnOf = (leadId: string | null = null, knowledge = "Tra sua: 50.000d"): CustomerTurn => ({
    conversation: {
        id: "c1",
        workspaceId: WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId,
        handledBy: null,
        visitorName: "Lan",
        installationId: null,
        agent: {
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Chatbot",
            module: "chatbot",
            instructions: "",
            knowledge,
            approvalRule: "",
            greeting: "",
        },
        speaksAs: null,
    },
    messageId: "m1",
    body: "I want one milk tea",
    channelEventId: "tg:42:1",
    transcript: [{ role: "user", body: "I want one milk tea" }],
})

/** A model proposal with settlement details and optional human-review overrides. */
export const proposalOf = (
    detail: Readonly<Record<string, unknown>>,
    changes: Partial<ChatTurnProposal> = {},
): ChatTurnProposal => ({
    reply: "Thanks!",
    needsHuman: false,
    reason: "",
    proposedAnswer: "",
    detail,
    ...changes,
})

import type { MockOf } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord, InstallationSettings } from "@modules/domain/module-installations"

import type { ChatTurnRuntime, CustomerOutcomes } from "@modules/domain/conversations"

/** The installation of the conversation agent, carrying the given settings. */
const installationOf = (settings: InstallationSettings): InstallationRecord => ({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Chatbot",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: null,
    settings,
    createdAt: "2026-10-12T10:00:00.000Z",
})

/** Shared typed fixture setup for these behavior proofs. */
export const NOW = Date.parse("2026-10-12T10:00:00.000Z")

/** Shared typed fixture setup for these behavior proofs. */
export const conversation = (patch: Partial<TurnConversation> = {}): TurnConversation => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "c-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    installationId: null,
    agent: {
        id: "agent-1",
        name: "Chatbot",
        handle: "chatbot",
        role: "Customer chat",
        module: "chatbot",
        instructions: "Be kind",
        knowledge: "Tea",
        approvalRule: "ask",
        greeting: "Hi",
    },
    speaksAs: null,
    ...patch,
})

interface Setup {
    readonly conversation?: TurnConversation | null
    readonly message?: boolean
    readonly setting?: InstallationSettings
    readonly retry?: boolean
    readonly held?: boolean
    readonly sent?: boolean
    readonly name?: string
}

/** What the spec plugs into a turn, and when. */
interface Plugged {
    /** The AI step, once plugged. */
    runtime?: ChatTurnRuntime
    /** The outcome handler, once plugged. */
    outcomes?: CustomerOutcomes
}

/**
 * The extensions a spec can plug a runtime and an outcome handler into at any point, like the app root does at start.
 */
export const chatTurnExtensionsOf = () => {
    const plugged: Plugged = {}
    return {
        runtime: () => plugged.runtime,
        outcomes: () => plugged.outcomes,
        useRuntime: (runtime: ChatTurnRuntime) => {
            plugged.runtime = runtime
        },
        useOutcomes: (outcomes: CustomerOutcomes) => {
            plugged.outcomes = outcomes
        },
    }
}

interface ChatTurnDoubles {
    readonly installations: MockOf<InstallationRecordsService>
    readonly conversations: MockOf<AgentConversationsService>
    readonly messages: MockOf<AgentMessagesService>
    readonly receipts: MockOf<ChannelReceiptsService>
    readonly delivery: MockOf<ChannelDeliveryService>
}

/** Configures the exact kit dependency references supplied by the ChatTurnService spec. */
export const arrangeChatTurn = (doubles: ChatTurnDoubles, setup: Setup = {}): void => {
    const { installations, conversations, messages, receipts, delivery } = doubles
    installations.ofAgent.mockResolvedValue(setup.setting === undefined ? null : installationOf(setup.setting))
    conversations.turnOf.mockResolvedValue(
        setup.conversation === null
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: setup.conversation ?? conversation() },
    )
    conversations.rename.mockResolvedValue(undefined)
    messages.find.mockResolvedValue(
        setup.message === false
            ? { kind: "refused", code: AgentMessagesErrorCode.NotFound }
            : { kind: "ok", value: { id: "msg-1", role: "user", body: "Price?", deliveryStatus: null } },
    )
    messages.transcript.mockResolvedValue([{ role: "user", body: "Price?" }])
    messages.storeReply.mockImplementation((_ws, _conv, body) =>
        Promise.resolve({ id: "reply-1", body, sent: setup.sent === true }),
    )
    messages.storeLine.mockResolvedValue(undefined)
    messages.replyExists.mockResolvedValue(setup.retry === true)
    receipts.heldSince.mockResolvedValue(setup.held === true)
    receipts.rememberHolding.mockResolvedValue(undefined)
    delivery.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null })
    delivery.showTyping.mockResolvedValue(undefined)
    delivery.customerName.mockResolvedValue(setup.name ?? "")
}

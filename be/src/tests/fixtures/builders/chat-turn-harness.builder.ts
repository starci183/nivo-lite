import type { MockOf } from "@starci/jest-preset"
import {
    ChatConversationsService,
    ChatMessagesService,
    ChatRecordsErrorCode,
    type ChatTurnConversation,
} from "@modules/domain/chat-records"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { ChannelDeliveryService } from "@modules/domain/channels"
import {
    InstallationRecordsService,
    type InstallationRecord,
    type InstallationSettings,
} from "@modules/domain/module-installations"
import type { CustomerOutcomes } from "@modules/domain/conversations"

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
export const NOW: number = Date.parse("2026-10-12T10:00:00.000Z")

/** Shared typed fixture setup for these behavior proofs. */
export const conversation = (patch: Partial<ChatTurnConversation> = {}): ChatTurnConversation => ({
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
    readonly conversation?: ChatTurnConversation | null
    readonly message?: boolean
    readonly setting?: InstallationSettings
    readonly retry?: boolean
    readonly held?: boolean
    readonly sent?: boolean
    readonly name?: string
}

/** What the spec plugs into a turn, and when. */
interface Plugged {
    /** The outcome handler, once plugged. */
    outcomes?: CustomerOutcomes
}

/**
 * The extensions a spec can plug an outcome handler into at any point, like the app root does at start.
 */
export const chatTurnExtensionsOf = () => {
    const plugged: Plugged = {}
    return {
        outcomes: (): CustomerOutcomes | undefined => plugged.outcomes,
        useOutcomes: (outcomes: CustomerOutcomes): void => {
            plugged.outcomes = outcomes
        },
    }
}

interface ChatTurnDoubles {
    readonly installations: MockOf<InstallationRecordsService>
    readonly conversations: MockOf<ChatConversationsService>
    readonly messages: MockOf<ChatMessagesService>
    readonly receipts: MockOf<ChannelReceiptsService>
    readonly delivery: MockOf<ChannelDeliveryService>
}

/** Configures the exact kit dependency references supplied by the ChatTurnService spec. */
export const arrangeChatTurn = (doubles: ChatTurnDoubles, setup: Setup = {}): void => {
    const { installations, conversations, messages, receipts, delivery } = doubles
    installations.ofAgent.mockResolvedValue(setup.setting === undefined ? null : installationOf(setup.setting))
    conversations.turnOf.mockResolvedValue(
        setup.conversation === null
            ? { kind: "refused", code: ChatRecordsErrorCode.NotFound }
            : { kind: "ok", value: setup.conversation ?? conversation() },
    )
    conversations.rename.mockResolvedValue(undefined)
    messages.find.mockResolvedValue(
        setup.message === false
            ? { kind: "refused", code: ChatRecordsErrorCode.NotFound }
            : { kind: "ok", value: { id: "msg-1", role: "user", body: "Price?", deliveryStatus: null } },
    )
    messages.transcript.mockResolvedValue([{ role: "user", body: "Price?" }])
    messages.storeAgentLine.mockImplementation((line) =>
        Promise.resolve({ id: "reply-1", body: line.body, sent: setup.sent === true }),
    )
    messages.storeLine.mockResolvedValue(undefined)
    messages.replyExists.mockResolvedValue(setup.retry === true)
    receipts.heldSince.mockResolvedValue(setup.held === true)
    receipts.rememberHolding.mockResolvedValue(undefined)
    delivery.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null })
    delivery.showTyping.mockResolvedValue(undefined)
    delivery.customerName.mockResolvedValue(setup.name ?? "")
}

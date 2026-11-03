import type {
    ChatTurnFacts,
    AgentChatPageData,
    RequestChatFileUpload,
    SendAgentChatRequest,
    TakeOverAgentChatRequest,
    AgentChatTurnStatusRequest,
    AgentChatHolder,
    AgentChatTurnStatus,
    QueuedAgentChatTurn,
    StartAgentChatRequest,
} from "@modules/domain/agent-chat"
import type { CustomerIntakeService, MessageIntake } from "@modules/domain/conversations"
import type { ChatFilesService } from "@modules/domain/chat-files"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { builder } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type {
    AgentConversationsReadService,
    AgentConversationsService,
    ChatConversation,
    ConversationTarget,
} from "@modules/domain/agent-conversations"
import type {
    AgentMessageDeliveriesService,
    AgentMessagesService,
    AgentThreadMessage,
} from "@modules/domain/agent-messages"
import type { AgentProfile } from "@modules/domain/agents"

const CHAT_NOW = "2026-10-13T02:00:00.000Z"

export const PROFILE: AgentProfile = {
    id: "a1",
    name: "Nivo",
    handle: "nivo",
    role: "receptionist",
    instructions: "Be brief",
    knowledge: "Open 9 to 6",
    approval_rule: "owner",
    module: "chatbot",
}

export const CONVERSATION: ChatConversation = {
    id: "c1",
    kind: "test",
    channel: "website",
    visitorName: "Lan",
    leadId: null,
    handledBy: null,
    createdAt: CHAT_NOW,
}

export const TARGET: ConversationTarget = {
    id: "c1",
    workspaceId: "w1",
    channel: "website",
    externalId: null,
    connectionId: null,
}

export const THREAD: AgentThreadMessage = { id: "m1", role: "user", body: "Hi", createdAt: CHAT_NOW }

export const TURN: ChatTurnFacts = {
    id: "m1",
    conversationId: "c1",
    channel: "website",
    role: "user",
    deliveryStatus: null,
    replyId: "r1",
    replyDeliveryStatus: null,
}

/** Makes the owners behind a chat turn answer the facts of one turn (none for a turn the workspace does not hold). */
export const arrangeTurnOwners = (
    deliveries: MockOf<AgentMessageDeliveriesService>,
    conversationReads: MockOf<AgentConversationsReadService>,
    turn: ChatTurnFacts | null,
): void => {
    deliveries.turnMessageOf.mockResolvedValue(
        turn === null
            ? null
            : {
                  id: turn.id,
                  conversationId: turn.conversationId,
                  role: turn.role,
                  deliveryStatus: turn.deliveryStatus,
              },
    )
    const replyId = turn?.replyId ?? null
    deliveries.agentReplyTo.mockResolvedValue(
        turn === null || replyId === null ? null : { id: replyId, deliveryStatus: turn.replyDeliveryStatus },
    )
    conversationReads.channelOf.mockResolvedValue(turn?.channel ?? null)
}

/** The member who sends in the chat specs. */
export const MEMBER_LAN: WorkspaceMember = {
    userId: "u1",
    workspaceId: "w1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

interface ChatFileSendOwners {
    readonly files: MockOf<ChatFilesService>
    readonly conversations: MockOf<AgentConversationsService>
    readonly messages: MockOf<AgentMessagesService>
}
type ChatNamelessChatsShapeOf = {
    readonly kind: "customer"
    readonly visitorName: null
}

type ChatNamelessChatsShape = {
    readonly kind: "test"
    readonly visitorName: "Lan"
}

type ChatShape = {
    page: (overrides?: Partial<AgentChatPageData>) => AgentChatPageData
    salesPage: (
        overrides?: Partial<Pick<AgentChatPageData, "module" | "avatarUrl" | "hasCustomerChannel" | "showWelcome">>,
    ) => Pick<AgentChatPageData, "module" | "avatarUrl" | "hasCustomerChannel" | "showWelcome">
    longVisitor: (overrides?: Partial<StartAgentChatRequest>) => StartAgentChatRequest
    customerAccepted: (overrides?: Partial<QueuedAgentChatTurn>) => QueuedAgentChatTurn
    customerWake: (overrides?: Partial<MessageIntake>) => MessageIntake
    humanAccepted: (overrides?: Partial<QueuedAgentChatTurn>) => QueuedAgentChatTurn
    releasedHolder: (overrides?: Partial<AgentChatHolder>) => AgentChatHolder
    queuedStatus: (overrides?: Partial<AgentChatTurnStatus>) => AgentChatTurnStatus
    runningStatus: (
        overrides?: Partial<Pick<AgentChatTurnStatus, "status" | "errorCode">>,
    ) => Pick<AgentChatTurnStatus, "status" | "errorCode">
    succeededStatus: (
        overrides?: Partial<Pick<AgentChatTurnStatus, "status" | "errorCode" | "resultMessageId">>,
    ) => Pick<AgentChatTurnStatus, "status" | "errorCode" | "resultMessageId">
    failedDelivery: (overrides?: Partial<ChatTurnFacts>) => ChatTurnFacts
    failedDeliveryStatus: (overrides?: Partial<AgentChatTurnStatus>) => AgentChatTurnStatus
    failedQueueStatus: (
        overrides?: Partial<Pick<AgentChatTurnStatus, "status" | "errorCode">>,
    ) => Pick<AgentChatTurnStatus, "status" | "errorCode">
    fileAccepted: (overrides?: Partial<QueuedAgentChatTurn>) => QueuedAgentChatTurn
    fileWake: (overrides?: Partial<MessageIntake>) => MessageIntake
    namelessChats: readonly [ChatNamelessChatsShape, ChatNamelessChatsShapeOf]
    externalDeliveries: readonly [
        readonly ["failed", "failed", "CHAT_DELIVERY_FAILED"],
        readonly ["sent", "succeeded", null],
    ]
    externalStatus: (
        status: AgentChatTurnStatus["status"],
        errorCode: AgentChatTurnStatus["errorCode"],
    ) => AgentChatTurnStatus
    turn: (overrides?: Partial<AgentChatTurnStatusRequest>) => AgentChatTurnStatusRequest
    send: (overrides?: Partial<SendAgentChatRequest>) => SendAgentChatRequest
    start: (overrides?: Partial<StartAgentChatRequest>) => StartAgentChatRequest
    take: (overrides?: Partial<TakeOverAgentChatRequest>) => TakeOverAgentChatRequest
    memberHolder: (overrides?: Partial<AgentChatHolder>) => AgentChatHolder
    staffHolder: (overrides?: Partial<AgentChatHolder>) => AgentChatHolder
    uploadRequest: (overrides?: Partial<RequestChatFileUpload>) => RequestChatFileUpload
    arrangeFileSend: (
        { files, conversations, messages }: ChatFileSendOwners,
        checked: Parameters<ChatFilesService["attach"]>[1],
    ) => void
    arrangeAttachmentFailure: (
        { files, conversations, messages }: ChatFileSendOwners,
        checked: Parameters<ChatFilesService["attach"]>[1],
        failure: Error,
    ) => void
}

/** Deterministic page, submission and delivery answers used by the chat service boundary cases. */
export const CHAT: ChatShape = {
    page: builder<AgentChatPageData>({
        id: "a1",
        module: "chatbot",
        name: "Nivo",
        handle: "nivo",
        role: "receptionist",
        avatarUrl: null,
        isActive: true,
        hasCustomerChannel: true,
        workspaceId: "w1",
        showWelcome: true,
    }),
    salesPage: builder<Pick<AgentChatPageData, "module" | "avatarUrl" | "hasCustomerChannel" | "showWelcome">>({
        module: "sales",
        avatarUrl: null,
        hasCustomerChannel: false,
        showWelcome: false,
    }),
    longVisitor: builder<StartAgentChatRequest>({
        workspaceId: "w1",
        agentId: "a1",
        kind: "customer",
        visitorName: ` ${"n".repeat(90)} `,
    }),
    customerAccepted: builder<QueuedAgentChatTurn>({
        id: "m1",
        conversationId: "c1",
        status: "queued",
    }),
    customerWake: builder<Parameters<CustomerIntakeService["answerChat"]>[0]>({
        workspaceId: "w1",
        conversationId: "c1",
        messageId: "m1",
        channelEventId: "agentchat:m1",
        lookupName: false,
    }),
    humanAccepted: builder<QueuedAgentChatTurn>({
        id: "m2",
        conversationId: "c1",
        status: "queued",
    }),
    releasedHolder: builder<AgentChatHolder>({
        conversationId: "c1",
        handledBy: null,
    }),
    queuedStatus: builder<AgentChatTurnStatus>({
        id: "m1",
        jobId: "job-1",
        conversationId: "c1",
        status: "queued",
        resultMessageId: "r1",
        errorCode: null,
    }),
    runningStatus: builder<Pick<AgentChatTurnStatus, "status" | "errorCode">>({
        status: "running",
        errorCode: null,
    }),
    succeededStatus: builder<Pick<AgentChatTurnStatus, "status" | "resultMessageId" | "errorCode">>({
        status: "succeeded",
        resultMessageId: "r1",
        errorCode: null,
    }),
    failedDelivery: builder<ChatTurnFacts>({
        ...TURN,
        channel: "zalo",
        role: "agent",
        deliveryStatus: "failed",
        replyId: null,
    }),
    failedDeliveryStatus: builder<AgentChatTurnStatus>({
        id: "m1",
        jobId: "job-2",
        conversationId: "c1",
        status: "failed",
        resultMessageId: "m1",
        errorCode: "CHAT_DELIVERY_FAILED",
    }),
    failedQueueStatus: builder<Pick<AgentChatTurnStatus, "status" | "errorCode">>({
        status: "failed",
        errorCode: "CHAT_TURN_FAILED",
    }),
    fileAccepted: builder<QueuedAgentChatTurn>({
        id: "m-file",
        conversationId: "c1",
        status: "queued",
    }),
    fileWake: builder<Parameters<CustomerIntakeService["answerChat"]>[0]>({
        workspaceId: "w1",
        conversationId: "c1",
        messageId: "m-file",
        channelEventId: "agentchat:m-file",
        lookupName: false,
    }),
    namelessChats: [
        { kind: "test", visitorName: "Lan" },
        { kind: "customer", visitorName: null },
    ] as const,
    externalDeliveries: [
        ["failed", "failed", "CHAT_DELIVERY_FAILED"],
        ["sent", "succeeded", null],
    ] as const,
    externalStatus: (
        status: AgentChatTurnStatus["status"],
        errorCode: AgentChatTurnStatus["errorCode"],
    ): AgentChatTurnStatus => ({
        id: "m1",
        jobId: "job-1",
        conversationId: "c1",
        status,
        resultMessageId: "r1",
        errorCode,
    }),
    turn: builder<AgentChatTurnStatusRequest>({ workspaceId: "w1", id: "m1" }),
    send: builder<SendAgentChatRequest>({ workspaceId: "w1", conversationId: "c1", body: "Hello", file: null }),
    start: builder<StartAgentChatRequest>({ workspaceId: "w1", agentId: "a1", kind: "customer", visitorName: null }),
    take: builder<TakeOverAgentChatRequest>({ workspaceId: "w1", conversationId: "c1", take: true, line: "" }),
    memberHolder: builder<AgentChatHolder>({ conversationId: "c1", handledBy: "Lan" }),
    staffHolder: builder<AgentChatHolder>({ conversationId: "c1", handledBy: "staff" }),
    uploadRequest: builder<RequestChatFileUpload>({
        workspaceId: "w1",
        conversationId: "c1",
        contentType: "image/png",
        sizeBytes: 9,
    }),
    arrangeFileSend: (
        { files, conversations, messages }: ChatFileSendOwners,
        checked: Parameters<ChatFilesService["attach"]>[1],
    ): void => {
        files.verify.mockResolvedValue(checked)
        files.wordsOf.mockReturnValue("sent a file")
        conversations.lockChat.mockResolvedValue(CONVERSATION)
        messages.storeCustomer.mockResolvedValue("m-file")
    },
    arrangeAttachmentFailure: (
        { files, conversations, messages }: ChatFileSendOwners,
        checked: Parameters<ChatFilesService["attach"]>[1],
        failure: Error,
    ): void => {
        files.verify.mockResolvedValue(checked)
        files.attach.mockRejectedValue(failure)
        conversations.lockChat.mockResolvedValue(CONVERSATION)
        messages.storeCustomer.mockResolvedValue("m-file")
    },
}

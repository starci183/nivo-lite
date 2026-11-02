import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import {
    AgentConversationsErrorCode,
    AgentConversationsReadService,
    AgentConversationsService,
} from "@modules/domain/agent-conversations"
import { AgentMessageDeliveriesService, AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import { CustomerIntakeService } from "@modules/domain/conversations"
import { ChatFilesService } from "@modules/domain/chat-files"
import { NO_CHAT_FILES } from "@tests/fixtures/builders/chat-files.builder"
import {
    CHAT,
    CONVERSATION,
    MEMBER_LAN,
    PROFILE,
    TARGET,
    THREAD,
    TURN,
    arrangeTurnOwners,
} from "@tests/fixtures/builders/agent-chat-turn.builder"
import { AgentDirectoryService, AgentsService } from "@modules/domain/agents"
import { EventsReadService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_STATUS } from "@modules/platform/queue"
import type { QueueStatusService } from "@modules/platform/queue"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { AgentChatService } from "./agent-chat.service"
import { AGENT_CHAT_FOUNDING_OFFER } from "./agent-chat.templates"
import { AgentChatErrorCode } from "./errors/agent-chat.error"
import type { ChatAgentFacts, ChatTurnFacts } from "./agent-chat.contracts"

const NOW = "2026-10-13T02:00:00.000Z"
const PAGE = { workspaceId: "w1", agentId: "a1", welcome: true }
const THREAD_REQUEST = { workspaceId: "w1", conversationId: "c1" }

const MEMBER = MEMBER_LAN

const AGENT: ChatAgentFacts = { id: "a1", module: "chatbot", status: "active", greeting: "Welcome", avatarUrl: null }

const build = async (agent: ChatAgentFacts | null = null, turn: ChatTurnFacts | null = null) => {
    const deliveries = mock<AgentMessageDeliveriesService>()
    const conversationReads = mock<AgentConversationsReadService>()
    arrangeTurnOwners(deliveries, conversationReads, turn)
    const directory = mock<AgentDirectoryService>()
    directory.chatFactsOf.mockResolvedValue(agent)
    const tx = fakeTransaction(mockEntityManager())
    const clock = new FakeClock(NOW)
    const members = mock<WorkspaceMembersService>()
    const agents = mock<AgentsService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const events = mock<EventsReadService>()
    events.existsOfKindBetween.mockResolvedValue(false)
    const turns = mock<ChatTurnQueue>()
    const intake = mock<CustomerIntakeService>()
    const work = mock<AgentWorkReadService>({ customerWake: jest.fn().mockResolvedValue(null) })
    const queueStatus = mock<QueueStatusService>()
    const files = mock<ChatFilesService>({
        viewsOf: jest.fn(NO_CHAT_FILES.viewsOf),
        wordsOf: jest.fn(NO_CHAT_FILES.wordsOf),
    })
    members.require.mockResolvedValue(MEMBER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentsService, useValue: agents },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: AgentMessageDeliveriesService, useValue: deliveries },
            { provide: AgentConversationsReadService, useValue: conversationReads },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: EventsReadService, useValue: events },
            { provide: ChatTurnQueue, useValue: turns },
            { provide: CustomerIntakeService, useValue: intake },
            { provide: AgentWorkReadService, useValue: work },
            { provide: QUEUE_STATUS, useValue: queueStatus },
            { provide: ChatFilesService, useValue: files },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentChatService),
        tx,
        clock,
        members,
        agents,
        conversations,
        messages,
        events,
        turns,
        intake,
        work,
        queueStatus,
        directory,
        deliveries,
        conversationReads,
        files,
    }
}

describe("AgentChatService", () => {
    describe("page", () => {
        it("returns the agent page and the welcome when a founding purchase sits inside the offer", async () => {
            const { service, agents, events } = await build(AGENT)
            agents.profileOf.mockResolvedValue(PROFILE)
            events.existsOfKindBetween.mockResolvedValue(true)

            await expect(service.page("u1", PAGE)).resolves.toEqual(CHAT.page())
            const { startsAt, endsAt } = AGENT_CHAT_FOUNDING_OFFER
            expect(events.existsOfKindBetween).toHaveBeenCalledWith(
                "w1",
                "module.purchased",
                new Date(startsAt),
                new Date(endsAt),
            )
        })

        it("hides the welcome outside the offer and does not read purchases", async () => {
            const { service, agents, clock, directory, events } = await build(AGENT)
            clock.set("2026-11-01T00:00:00.000Z")
            agents.profileOf.mockResolvedValue(PROFILE)

            await expect(service.page("u1", PAGE)).resolves.toMatchObject({ showWelcome: false, isActive: true })
            expect(events.existsOfKindBetween).not.toHaveBeenCalled()
            expect(directory.chatFactsOf).toHaveBeenCalledWith("w1", "a1")
        })

        it("hides the welcome for a module that has no customer channel", async () => {
            const { service, agents } = await build({ ...AGENT, module: "sales" })
            agents.profileOf.mockResolvedValue(PROFILE)

            await expect(service.page("u1", PAGE)).resolves.toMatchObject(CHAT.salesPage())
        })

        it.each([
            { name: "agent row", found: undefined, profile: PROFILE },
            { name: "agent profile", found: AGENT, profile: null },
        ])("refuses a missing $name", async ({ found, profile }) => {
            const { service, agents } = await build(found ?? null)
            agents.profileOf.mockResolvedValue(profile)

            await expect(service.page("u1", PAGE)).rejects.toMatchObject({ code: AgentChatErrorCode.AgentNotFound })
        })
    })
})

describe("AgentChatService", () => {
    describe("listConversations", () => {
        it("returns the agent's history after proving the agent", async () => {
            const { service, conversations } = await build(AGENT)
            conversations.listChat.mockResolvedValue([CONVERSATION])

            await expect(service.listConversations("u1", { workspaceId: "w1", agentId: "a1" })).resolves.toEqual([
                CONVERSATION,
            ])
            expect(conversations.listChat).toHaveBeenCalledWith("w1", "a1")
        })
    })

    describe("listMessages", () => {
        it("returns the thread when the conversation belongs to the workspace", async () => {
            const { service, conversations, messages } = await build()
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: TARGET })
            messages.listChat.mockResolvedValue([THREAD])

            await expect(service.listMessages("u1", THREAD_REQUEST)).resolves.toEqual([{ ...THREAD, files: [] }])
            expect(messages.listChat).toHaveBeenCalledWith("w1", "c1")
        })

        it("refuses a conversation that belongs to another workspace", async () => {
            const { service, conversations, messages } = await build()
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: { ...TARGET, workspaceId: "w2" } })

            await expect(service.listMessages("u1", THREAD_REQUEST)).rejects.toMatchObject({
                code: AgentChatErrorCode.ConversationNotFound,
            })
            expect(messages.listChat).not.toHaveBeenCalled()
        })
    })
})

describe("AgentChatService", () => {
    describe("start", () => {
        it("opens a test chat under the member's name and stores the greeting", async () => {
            const { service, conversations, messages, tx } = await build(AGENT)
            conversations.openChat.mockResolvedValue(CONVERSATION)

            await expect(service.start("u1", CHAT.start({ kind: "test", visitorName: "  " }))).resolves.toBe("c1")
            expect(conversations.openChat).toHaveBeenCalledWith(
                CHAT.start({ kind: "test", visitorName: "Lan" }),
                expect.anything(),
            )
            expect(messages.storeGreeting).toHaveBeenCalledWith("w1", "c1", "Welcome", expect.anything())
            expect(tx.commits).toBe(1)
        })

        it("keeps a customer name within 80 characters and skips an empty greeting", async () => {
            const { service, conversations, messages, tx } = await build({ ...AGENT, greeting: "" })
            conversations.openChat.mockResolvedValue(CONVERSATION)

            await expect(service.start("u1", CHAT.longVisitor())).resolves.toBe("c1")
            expect(conversations.openChat).toHaveBeenCalledWith(
                CHAT.start({ visitorName: "n".repeat(80) }),
                expect.anything(),
            )
            expect(messages.storeGreeting).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        })

        it("does not open a chat when the agent is missing", async () => {
            const { service, conversations, tx } = await build()

            await expect(service.start("u1", CHAT.start())).rejects.toMatchObject({
                code: AgentChatErrorCode.AgentNotFound,
            })
            expect(tx.commits).toBe(0)
            expect(conversations.openChat).not.toHaveBeenCalled()
        })
    })
})

describe("AgentChatService", () => {
    describe("send", () => {
        it("stores a customer message and queues a turn", async () => {
            const { service, conversations, messages, intake, tx } = await build()
            conversations.lockChat.mockResolvedValue({ ...CONVERSATION, kind: "customer", handledBy: null })
            messages.storeCustomer.mockResolvedValue("m1")

            await expect(service.send("u1", CHAT.send({ body: "  Hello  " }))).resolves.toEqual(CHAT.customerAccepted())
            expect(messages.storeCustomer).toHaveBeenCalledWith("w1", "c1", "Hello", expect.anything(), "u1")
            expect(intake.answerChat).toHaveBeenCalledWith(CHAT.customerWake(), expect.anything())
            expect(tx.commits).toBe(1)
        })

        it("stores a held customer chat as a human delivery", async () => {
            const { service, conversations, messages, turns } = await build()
            conversations.lockChat.mockResolvedValue({ ...CONVERSATION, kind: "customer", handledBy: "Lan" })
            messages.storeHuman.mockResolvedValue("m2")

            await expect(service.send("u1", CHAT.send({ body: "On my way" }))).resolves.toEqual(CHAT.humanAccepted())
            expect(messages.storeHuman).toHaveBeenCalledWith("w1", "c1", "On my way", "Lan", expect.anything(), "u1")
            expect(turns.enqueueChatTurn).toHaveBeenCalledWith(
                expect.objectContaining({ kind: "deliver", messageId: "m2", channelEventId: "agentchat:m2" }),
                expect.anything(),
            )
        })

        it("refuses an empty or oversized body before opening a transaction", async () => {
            const { service, tx, turns } = await build()

            await expect(service.send("u1", CHAT.send({ body: "   " }))).rejects.toMatchObject({
                code: AgentChatErrorCode.InvalidBody,
            })
            await expect(service.send("u1", CHAT.send({ body: "a".repeat(4001) }))).rejects.toMatchObject({
                code: AgentChatErrorCode.InvalidBody,
            })
            expect(tx.commits).toBe(0)
            expect(turns.enqueueChatTurn).not.toHaveBeenCalled()
        })
    })
})

describe("AgentChatService", () => {
    describe("takeOver", () => {
        it("records the member as holder and substitutes their name in the line", async () => {
            const { service, conversations, messages, tx } = await build()
            conversations.lockChat.mockResolvedValue(CONVERSATION)

            await expect(service.takeOver("u1", CHAT.take({ line: "Hi {user}" }))).resolves.toEqual(CHAT.memberHolder())
            expect(conversations.setChatHolder).toHaveBeenCalledWith("w1", "c1", "Lan", expect.anything())
            expect(messages.storeLine).toHaveBeenCalledWith("w1", "c1", "Hi Lan", expect.anything())
            expect(tx.commits).toBe(1)
        })

        it("returns the chat to the agent and skips a blank line", async () => {
            const { service, members, conversations, messages } = await build()
            members.require.mockResolvedValue({ ...MEMBER, displayName: "" })
            conversations.lockChat.mockResolvedValue(CONVERSATION)

            await expect(service.takeOver("u1", CHAT.take({ take: false, line: "   " }))).resolves.toEqual(
                CHAT.releasedHolder(),
            )
            expect(conversations.setChatHolder).toHaveBeenCalledWith("w1", "c1", null, expect.anything())
            expect(messages.storeLine).not.toHaveBeenCalled()
        })

        it("uses staff when a takeover has no display name, and cuts the line at 400 characters", async () => {
            const { service, members, conversations, messages } = await build()
            members.require.mockResolvedValue({ ...MEMBER, displayName: "" })
            conversations.lockChat.mockResolvedValue(CONVERSATION)

            await expect(service.takeOver("u1", CHAT.take({ line: "b".repeat(401) }))).resolves.toEqual(
                CHAT.staffHolder(),
            )
            expect(messages.storeLine).toHaveBeenCalledWith("w1", "c1", "b".repeat(400), expect.anything())
        })
    })
})

describe("AgentChatService", () => {
    describe("turnStatus", () => {
        it("reports a queued turn and the stored reply id", async () => {
            const { service, queueStatus } = await build(null, TURN)
            queueStatus.status.mockResolvedValue({ id: "job-1", state: "queued", attempts: 0 })

            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toEqual(CHAT.queuedStatus())
            expect(queueStatus.status).toHaveBeenCalledWith("w1", "chat_turn", "chat-turn.turn:m1")
        })

        it("reports running, then succeeded once a website turn is done", async () => {
            const { service, queueStatus } = await build(null, TURN)
            queueStatus.status.mockResolvedValueOnce({ id: "job-1", state: "running", attempts: 1 })
            queueStatus.status.mockResolvedValueOnce({ id: "job-1", state: "done", attempts: 1 })

            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toMatchObject(CHAT.runningStatus())
            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toMatchObject(CHAT.succeededStatus())
        })

        it("reports a failed delivery on a channel other than website", async () => {
            const delivered: ChatTurnFacts = CHAT.failedDelivery()
            const { service, queueStatus } = await build(null, delivered)
            queueStatus.status.mockResolvedValue({ id: "job-2", state: "done", attempts: 1 })

            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toEqual(CHAT.failedDeliveryStatus())
            expect(queueStatus.status).toHaveBeenCalledWith("w1", "chat_turn", "chat-turn.deliver:m1")
        })

        it("reports a failed queue job as a turn failure", async () => {
            const { service, queueStatus } = await build(null, TURN)
            queueStatus.status.mockResolvedValue({ id: "job-3", state: "failed", attempts: 2 })

            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toMatchObject(CHAT.failedQueueStatus())
        })

        it("refuses a message or a job the workspace does not have", async () => {
            const missing = await build()
            await expect(missing.service.turnStatus("u1", CHAT.turn())).rejects.toMatchObject({
                code: AgentChatErrorCode.TurnNotFound,
            })

            const { service, queueStatus } = await build(null, TURN)
            queueStatus.status.mockResolvedValue(null)
            await expect(service.turnStatus("u1", CHAT.turn())).rejects.toMatchObject({
                code: AgentChatErrorCode.TurnNotFound,
            })
        })
    })
})

it("follows the wake of a message the core road answers, since it has no chat-turn job", async () => {
    const { service, queueStatus, work } = await build(null, TURN)
    queueStatus.status.mockResolvedValue(null)
    work.customerWake.mockResolvedValue({ id: "wake-1", state: "failed" })
    const status = service.turnStatus("u1", CHAT.turn())
    await expect(status).resolves.toMatchObject({ jobId: "wake-1", status: "failed" })
})
describe("AgentChatService", () => {
    it.each(CHAT.namelessChats)("defaults a nameless $kind chat to $visitorName", async ({ kind, visitorName }) => {
        const { service, tx, conversations, messages } = await build(AGENT)
        conversations.openChat.mockResolvedValue(CONVERSATION)
        await expect(service.start("u1", CHAT.start({ kind }))).resolves.toBe("c1")
        const manager = conversations.openChat.mock.calls[0]?.[1]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(conversations.openChat).toHaveBeenCalledWith(CHAT.start({ kind, visitorName }), manager)
        expect(messages.storeGreeting).toHaveBeenCalledWith("w1", "c1", "Welcome", manager)
        expect(tx.commits).toBe(1)
    })

    it("refuses a thread that the conversation owner reports as missing", async () => {
        const { service, members, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
        await expect(service.listMessages("u1", THREAD_REQUEST)).rejects.toMatchObject({
            code: AgentChatErrorCode.ConversationNotFound,
        })
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(conversations.targetOf).toHaveBeenCalledWith("c1")
        expect(messages.listChat).not.toHaveBeenCalled()
    })

    it.each(CHAT.externalDeliveries)(
        "reports a completed external turn whose reply delivery is %s",
        async (delivery, status, errorCode) => {
            const external: ChatTurnFacts = { ...TURN, channel: "telegram", replyDeliveryStatus: delivery }
            const { service, deliveries, members, queueStatus } = await build(null, external)
            queueStatus.status.mockResolvedValue({ id: "job-1", state: "done", attempts: 2 })
            await expect(service.turnStatus("u1", CHAT.turn())).resolves.toEqual(CHAT.externalStatus(status, errorCode))
            expect(members.require).toHaveBeenCalledWith("u1", "w1")
            expect(deliveries.turnMessageOf).toHaveBeenCalledWith("w1", "m1")
            expect(queueStatus.status).toHaveBeenCalledWith("w1", "chat_turn", "chat-turn.turn:m1")
        },
    )

    it("refuses a message whose conversation channel the owner no longer holds", async () => {
        const { service, conversationReads } = await build(null, TURN)
        conversationReads.channelOf.mockResolvedValue(null)

        await expect(service.turnStatus("u1", CHAT.turn())).rejects.toMatchObject({
            code: AgentChatErrorCode.TurnNotFound,
        })
    })
})

describe("AgentChatService > requestFileUpload", () => {
    it("issues an upload only after membership and the conversation scope are proved", async () => {
        const { service, members, conversations, files } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: TARGET })
        const request = CHAT.uploadRequest()
        const upload = { path: "w1/chat/c1/receipt.png", signedUrl: "https://upload.invalid/receipt" }
        files.requestUpload.mockResolvedValue(upload)

        await expect(service.requestFileUpload("u1", request)).resolves.toEqual(upload)

        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(conversations.targetOf).toHaveBeenCalledWith("c1")
        expect(files.requestUpload).toHaveBeenCalledWith(request, request)
    })

    it("issues no address and reads no conversation when membership is refused", async () => {
        const { service, members, conversations, files } = await build()
        const refusal = new Error("not a member")
        members.require.mockRejectedValue(refusal)

        await expect(service.requestFileUpload("u1", CHAT.uploadRequest())).rejects.toBe(refusal)

        expect(conversations.targetOf).not.toHaveBeenCalled()
        expect(files.requestUpload).not.toHaveBeenCalled()
    })

    it("issues no address for a conversation in another workspace", async () => {
        const { service, conversations, files } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: { ...TARGET, workspaceId: "w2" } })

        await expect(service.requestFileUpload("u1", CHAT.uploadRequest())).rejects.toMatchObject({
            code: AgentChatErrorCode.ConversationNotFound,
        })

        expect(files.requestUpload).not.toHaveBeenCalled()
    })
})

describe("AgentChatService > send with a file", () => {
    const file = { path: "w1/chat/c1/receipt.png", name: "receipt.png" }
    const checked = { ...file, contentType: "image/png", sizeBytes: 9 }

    it("attaches the verified file to a file-only submission in the message transaction", async () => {
        const { service, files, conversations, messages, intake, tx } = await build()
        const request = CHAT.send({ body: " ", file })
        CHAT.arrangeFileSend({ files, conversations, messages }, checked)

        await expect(service.send("u1", request)).resolves.toEqual(CHAT.fileAccepted())

        const manager = messages.storeCustomer.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(manager).not.toBe(tx.em)
        expect(files.verify).toHaveBeenCalledWith(request, file.path, file.name)
        expect(messages.storeCustomer).toHaveBeenCalledWith("w1", "c1", "sent a file", manager, "u1")
        expect(files.attach).toHaveBeenCalledWith(request, checked, "m-file", manager)
        expect(intake.answerChat).toHaveBeenCalledWith(CHAT.fileWake(), manager)
        expect(tx.commits).toBe(1)
    })

    it("writes no message or wake when verification refuses the uploaded object", async () => {
        const { service, files, conversations, messages, intake, tx } = await build()
        const refusal = new Error("file is outside this conversation")
        files.verify.mockRejectedValue(refusal)

        await expect(service.send("u1", CHAT.send({ body: "receipt", file }))).rejects.toBe(refusal)

        expect(conversations.lockChat).not.toHaveBeenCalled()
        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(files.attach).not.toHaveBeenCalled()
        expect(intake.answerChat).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
        expect(tx.rollbacks).toBe(0)
    })

    it("rolls the message back and queues nothing when its attachment cannot be stored", async () => {
        const { service, files, conversations, messages, intake, turns, tx } = await build()
        const failure = new Error("attachment write failed")
        CHAT.arrangeAttachmentFailure({ files, conversations, messages }, checked, failure)

        await expect(service.send("u1", CHAT.send({ body: "receipt", file }))).rejects.toBe(failure)

        expect(intake.answerChat).not.toHaveBeenCalled()
        expect(turns.enqueueChatTurn).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
        expect(tx.rollbacks).toBe(1)
    })
})

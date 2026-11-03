import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import { InboundFilesService } from "@modules/domain/chat-files"
import type { DownloadedChatFile } from "@modules/domain/chat-files"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type { FrontAgent, MetaInbound } from "./conversations.contracts"
import { ConversationsService } from "./conversations.service"
import { CustomerIntakeService } from "./customer-intake.service"

const registerTelegramRouting = () => {
    it("opens the conversation of a new customer, stores the message and enqueues the turn", async () => {
        const manager = mockEntityManager()
        const { service, intake, conversations, messages } = await build({}, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(conversations.open).toHaveBeenCalledWith(openingOf(), manager)
        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager)
        expect(intake.answer).toHaveBeenCalledWith(queuedTurn(), manager)
    })

    it("continues the conversation of a known customer without opening or rebinding it", async () => {
        const manager = mockEntityManager()
        const { service, intake, conversations } = await build({ existing: known() }, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(conversations.open).not.toHaveBeenCalled()
        expect(conversations.rebind).not.toHaveBeenCalled()
        expect(intake.answer).toHaveBeenCalledTimes(1)
    })

    it("moves a conversation to the connection current front-door agent", async () => {
        const manager = mockEntityManager()
        const { service, conversations } = await build({ existing: known({ agentId: "agent-old" }) }, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(conversations.rebind).toHaveBeenCalledWith("conv-1", "agent-1", manager)
    })

    it("stores the message and enqueues nothing while a person holds the conversation", async () => {
        const manager = mockEntityManager()
        const { service, intake, messages } = await build({ existing: known({ handledBy: "Lan" }) }, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(messages.storeCustomer).toHaveBeenCalledTimes(1)
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it("only keeps the message in the inbox when no agent is bound to the connection", async () => {
        const manager = mockEntityManager()
        const { service, intake, inboundEvents, conversations } = await build({}, [])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            channel: "telegram",
            sender: "Minh Tran",
            body: "Hello",
            eventId: "tg:c-1:555:9",
        })
        expect(conversations.open).not.toHaveBeenCalled()
        expect(intake.answer).not.toHaveBeenCalled()
    })
    registerTelegramGuards()
}

const registerTelegramGuards = () => {
    it("ignores a delivery for a connection that is gone", async () => {
        const manager = mockEntityManager()
        const { service, intake, bindings } = await build({ connection: false }, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(bindings.routeInbound).not.toHaveBeenCalled()
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it("opens a new visit on /start: archives the old conversation and greets without an AI call", async () => {
        const manager = mockEntityManager()
        const { service, queue, conversations, messages } = await build({}, [FRONT_AGENT])

        await expect(
            service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager),
        ).resolves.toBeUndefined()
        expect(conversations.archive).toHaveBeenCalledWith("ws-1", "telegram", CONNECTION, "555", `555:${NOW}`, manager)
        expect(messages.storeGreeting).toHaveBeenCalledWith("ws-1", "conv-1", "Welcome!", manager)
        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(queue.enqueueChatTurn).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "deliver", conversationId: "conv-1", messageId: "greet-1" }),
            manager,
        )
    })

    it.each([["  "], [null]])("greets with the default line when the agent greeting is %j", async (greeting) => {
        const manager = mockEntityManager()
        const { service, messages, agents } = await build({}, [{ id: "agent-1", greeting: "  " }])
        agents.greetingOf.mockResolvedValue(greeting)

        await expect(
            service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager),
        ).resolves.toBeUndefined()
        expect(messages.storeGreeting).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "<conversations.fallbackGreeting>",
            manager,
        )
    })
}

const registerZaloRouting = () => {
    it("marks the connection received, opens the conversation and asks the job to look the customer name up", async () => {
        const manager = mockEntityManager()
        const { service, intake, connections, conversations, zalo } = await build({}, [FRONT_AGENT])
        zalo.load.mockResolvedValue({
            kind: "ok",
            value: {
                secret: { appId: "app-1", appSecret: "s", oaSecret: "o" },
                expiresAt: null,
                workspaceId: "ws-1",
            },
        })

        await expect(service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), manager)).resolves.toBe(true)
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            { amount: 0, content: "<conversations.zaloGuest>", at: new Date(NOW).toISOString(), text: "Hello" },
            manager,
        )
        expect(conversations.open).toHaveBeenCalledWith(
            expect.objectContaining({
                channel: "zalo",
                customerId: "user-1",
                visitor: "<conversations.zaloGuest>",
            }),
            manager,
        )
        expect(intake.answer).toHaveBeenCalledWith(
            queuedTurn({ channelEventId: "zalo:m-1", lookupName: true }),
            manager,
        )
    })

    it("keeps the name of a known customer, does not ask for it again and cuts the first event text at 160 characters", async () => {
        const manager = mockEntityManager()
        const { service, intake, connections } = await build({ existing: known() }, [FRONT_AGENT])

        await expect(
            service.acceptZalo(CONNECTION, zaloMessage({ text: "x".repeat(300) }), manager),
        ).resolves.toBe(true)
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            expect.objectContaining({ content: "Minh", text: "x".repeat(160) }),
            manager,
        )
        expect(intake.answer).toHaveBeenCalledWith(expect.objectContaining({ lookupName: false }), manager)
    })

    it("falls back to the guest name for a known customer without one", async () => {
        const manager = mockEntityManager()
        const { service, connections } = await build({ existing: known({ visitorName: null }) }, [FRONT_AGENT])

        await expect(service.acceptZalo(CONNECTION, zaloMessage(), manager)).resolves.toBe(true)
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            expect.objectContaining({ content: "<conversations.zaloGuest>" }),
            manager,
        )
    })
    registerZaloInbox()
}

const registerZaloInbox = () => {
    it("only keeps the message in the inbox when no agent is bound", async () => {
        const manager = mockEntityManager()
        const { service, intake, inboundEvents } = await build({}, [])

        await expect(service.acceptZalo(CONNECTION, zaloMessage(), manager)).resolves.toBe(false)
        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            channel: "zalo",
            sender: "<conversations.zaloGuest>",
            body: "Hello",
            eventId: "zalo:c-1:m-1",
        })
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it("ignores an event for another Zalo app and one for a connection that is gone", async () => {
        const otherManager = mockEntityManager()
        const other = await build({}, [FRONT_AGENT])
        other.zalo.load.mockResolvedValue({
            kind: "ok",
            value: {
                secret: { appId: "app-2", appSecret: "s", oaSecret: "o" },
                expiresAt: null,
                workspaceId: "ws-1",
            },
        })
        const goneManager = mockEntityManager({})
        const gone = await build({ connection: false })

        await expect(
            other.service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), otherManager),
        ).resolves.toBe(false)
        await expect(gone.service.acceptZalo(CONNECTION, zaloMessage(), goneManager)).resolves.toBe(false)
        expect(other.connections.markReceived).not.toHaveBeenCalled()
        expect(gone.connections.markReceived).not.toHaveBeenCalled()
    })

    it("accepts an event whose app cannot be checked because the credential is unreadable", async () => {
        const manager = mockEntityManager()
        const { service, connections, zalo } = await build({}, [FRONT_AGENT])
        zalo.load.mockResolvedValue({ kind: "refused", code: ChannelsErrorCode.SecretUnreadable })

        await expect(service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), manager)).resolves.toBe(true)
        expect(connections.markReceived).toHaveBeenCalledTimes(1)
    })
}

const registerMetaGuards = () => {
    it("ignores a delivery for a refused connection", async () => {
        const manager = mockEntityManager()
        const { service, connections, bindings, conversations, messages, inboundEvents, intake, catalog } = await build(
            { connection: false },
            [FRONT_AGENT],
        )

        await expect(service.acceptMeta(CONNECTION, metaMessage(), manager)).resolves.toBeUndefined()
        expect(connections.intakeOf).toHaveBeenCalledWith(CONNECTION, "meta", manager)
        expect(bindings.routeInbound).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
        expect(conversations.find).not.toHaveBeenCalled()
        expect(conversations.open).not.toHaveBeenCalled()
        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(messages.storeGreeting).not.toHaveBeenCalled()
        expect(inboundEvents.keepUnrouted).not.toHaveBeenCalled()
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it.each(["facebook", "instagram"] as const)(
        "keeps an unrouted %s delivery in the inbox with its connection-scoped event id",
        async (platform) => {
            const manager = mockEntityManager()
            const { service, connections, bindings, conversations, messages, inboundEvents, intake, catalog } =
                await build({}, [])

            await expect(service.acceptMeta(CONNECTION, metaMessage({ platform }), manager)).resolves.toBeUndefined()
            expect(connections.intakeOf).toHaveBeenCalledWith(CONNECTION, "meta", manager)
            expect(bindings.routeInbound).toHaveBeenCalledWith(CONNECTION)
            expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
                workspaceId: "ws-1",
                channel: platform,
                sender: "Minh Tran",
                body: "Hello",
                eventId: "meta:event-1:c-1",
            })
            expect(catalog.get).not.toHaveBeenCalled()
            expect(conversations.find).not.toHaveBeenCalled()
            expect(conversations.open).not.toHaveBeenCalled()
            expect(messages.storeCustomer).not.toHaveBeenCalled()
            expect(intake.answer).not.toHaveBeenCalled()
        },
    )
    registerMetaRouting()
    registerMetaGuestNames()
}

const registerMetaRouting = () => {
    it.each(["facebook", "instagram"] as const)(
        "opens a %s conversation for the person and stores and enqueues their message",
        async (platform) => {
            const manager = mockEntityManager()
            const { service, connections, bindings, conversations, messages, inboundEvents, intake, catalog } =
                await build({}, [FRONT_AGENT])

            await expect(service.acceptMeta(CONNECTION, metaMessage({ platform }), manager)).resolves.toBeUndefined()
            expect(connections.intakeOf).toHaveBeenCalledWith(CONNECTION, "meta", manager)
            expect(bindings.routeInbound).toHaveBeenCalledWith(CONNECTION)
            expect(conversations.find).toHaveBeenCalledWith("ws-1", platform, CONNECTION, "person-1", manager)
            expect(conversations.open).toHaveBeenCalledWith(
                openingOf({ channel: platform, customerId: "person-1" }),
                manager,
            )
            expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager)
            expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ channelEventId: "meta:event-1" }), manager)
            expect(catalog.get).not.toHaveBeenCalled()
            expect(inboundEvents.keepUnrouted).not.toHaveBeenCalled()
            expect(connections.markReceived).not.toHaveBeenCalled()
            expect(conversations.archive).not.toHaveBeenCalled()
            expect(messages.storeGreeting).not.toHaveBeenCalled()
        },
    )

    it.each(["facebook", "instagram"] as const)(
        "uses the %s guest catalog line for an unnamed person with a front agent",
        async (platform) => {
            const manager = mockEntityManager()
            const { service, conversations, catalog } = await build({}, [FRONT_AGENT])

            await expect(
                service.acceptMeta(CONNECTION, metaMessage({ platform, visitor: null }), manager),
            ).resolves.toBeUndefined()
            expect(catalog.get).toHaveBeenCalledWith(`conversations.${platform}Guest`, {}, "vi")
            expect(conversations.open).toHaveBeenCalledWith(
                openingOf({
                    channel: platform,
                    customerId: "person-1",
                    visitor: `<conversations.${platform}Guest>`,
                }),
                manager,
            )
        },
    )
}

const registerMetaGuestNames = () => {
    it.each(["facebook", "instagram"] as const)(
        "uses the %s guest catalog line for an unnamed unrouted person",
        async (platform) => {
            const manager = mockEntityManager()
            const { service, inboundEvents, catalog } = await build({}, [])

            await expect(
                service.acceptMeta(CONNECTION, metaMessage({ platform, visitor: null }), manager),
            ).resolves.toBeUndefined()
            expect(catalog.get).toHaveBeenCalledWith(`conversations.${platform}Guest`, {}, "vi")
            expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
                workspaceId: "ws-1",
                channel: platform,
                sender: `<conversations.${platform}Guest>`,
                body: "Hello",
                eventId: "meta:event-1:c-1",
            })
        },
    )

    it("preserves an empty visitor name supplied by Meta", async () => {
        const manager = mockEntityManager()
        const { service, conversations, catalog } = await build({}, [FRONT_AGENT])

        await expect(service.acceptMeta(CONNECTION, metaMessage({ visitor: "" }), manager)).resolves.toBeUndefined()
        expect(catalog.get).not.toHaveBeenCalled()
        expect(conversations.open).toHaveBeenCalledWith(
            openingOf({ channel: "facebook", customerId: "person-1", visitor: "" }),
            manager,
        )
    })
}

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const CONNECTION = "c-1"
const FRONT_AGENT = { id: "agent-1", greeting: "Welcome!" }

const queuedTurn = builder<Parameters<CustomerIntakeService["answer"]>[0]>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "tg:555:9",
    lookupName: false,
})

const openingOf = builder<Parameters<AgentConversationsService["open"]>[0]>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    channel: "telegram",
    customerId: "555",
    visitor: "Minh Tran",
    connectionId: CONNECTION,
})

const known = (patch: Partial<ConversationRef> = {}): ConversationRef => ({
    id: "conv-1",
    agentId: "agent-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    ...patch,
})

interface Setup {
    readonly connection?: boolean
    readonly existing?: ConversationRef
}

const bindingOf = (agent: FrontAgent) => ({
    id: agent.id,
    module: "chatbot",
    name: "Bot",
    access: "auto" as const,
    purpose: "inbound_chat" as const,
})

const build = async (setup: Setup = {}, front: ReadonlyArray<FrontAgent> = []) => {
    const [first] = front
    const bindings = mock<AgentBindingsService>()
    bindings.routeInbound.mockResolvedValue({ front: first === undefined ? null : bindingOf(first), handovers: [] })
    const agents = mock<AgentDirectoryService>()
    agents.greetingOf.mockResolvedValue(first === undefined ? null : first.greeting)
    const queue = mock<ChatTurnQueue>()
    queue.enqueueChatTurn.mockResolvedValue(undefined)
    const intake = mock<CustomerIntakeService>()
    intake.answer.mockResolvedValue(undefined)
    const connections = mock<ConnectionsService>()
    connections.intakeOf.mockResolvedValue(
        setup.connection === false
            ? { kind: "refused", code: ConnectionsErrorCode.NotFound }
            : { kind: "ok", value: { id: CONNECTION, workspaceId: "ws-1", status: "connected" } },
    )
    connections.markReceived.mockResolvedValue(undefined)
    const conversations = mock<AgentConversationsService>()
    conversations.find.mockResolvedValue(
        setup.existing === undefined
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: setup.existing },
    )
    conversations.open.mockResolvedValue(known())
    conversations.archive.mockResolvedValue(undefined)
    conversations.rebind.mockResolvedValue(undefined)
    const messages = mock<AgentMessagesService>()
    messages.storeCustomer.mockResolvedValue("msg-1")
    messages.storeGreeting.mockResolvedValue("greet-1")
    const inboundEvents = mock<InboundEventsService>()
    inboundEvents.keepUnrouted.mockResolvedValue(undefined)
    const zalo = mock<ZaloCredentialsService>()
    const inboundFiles = mock<InboundFilesService>()
    inboundFiles.keep.mockResolvedValue(true)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => `<${key}>`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ChatTurnQueue, useValue: queue },
            { provide: CustomerIntakeService, useValue: intake },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: ZaloCredentialsService, useValue: zalo },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: InboundFilesService, useValue: inboundFiles },
        ],
    }).compile()
    return {
        service: moduleRef.get(ConversationsService),
        inboundFiles,
        queue,
        intake,
        connections,
        conversations,
        messages,
        inboundEvents,
        zalo,
        catalog,
        bindings,
        agents,
    }
}

const telegram = (patch: Record<string, unknown> = {}) => ({
    updateId: 77,
    chatId: "555",
    messageId: 9,
    text: "Hello",
    visitor: "Minh Tran",
    isStart: false,
    ...patch,
})

const zaloMessage = (patch: Record<string, unknown> = {}) => ({
    appId: "",
    userId: "user-1",
    messageId: "m-1",
    text: "Hello",
    attachments: [],
    sentAt: null,
    ...patch,
})

const metaMessage = (patch: Partial<MetaInbound> = {}): MetaInbound => ({
    platform: "facebook",
    personId: "person-1",
    visitor: "Minh Tran",
    text: "Hello",
    eventId: "event-1",
    ...patch,
})

const receipt: DownloadedChatFile = {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    name: "a.png",
    sourceUrl: "https://cdn.test/a.png",
}

const registerZaloAttachments = () => {
    const picture = zaloMessage({
        text: "Em chuyen khoan roi",
        attachments: [{ kind: "image", url: "https://cdn.test/a.png", thumbnailUrl: "", name: "", localPath: "" }],
    })

    it("reaches the turn as the label of the picture and its caption, with the picture stored on the message", async () => {
        const manager = mockEntityManager()
        const { service, intake, messages, inboundFiles } = await build({}, [FRONT_AGENT])

        await expect(service.acceptZalo(CONNECTION, picture, manager, [receipt])).resolves.toBe(true)

        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.imageLabel> Em chuyen khoan roi", manager)
        expect(inboundFiles.keep).toHaveBeenCalledWith(
            { workspaceId: "ws-1", conversationId: "conv-1" },
            receipt,
            "zalo:m-1",
            "msg-1",
            manager,
        )
        expect(intake.answer).toHaveBeenCalledWith(expect.objectContaining({ channelEventId: "zalo:m-1", messageId: "msg-1" }), manager)
    })

    it("labels a picture that came without a caption by the label alone, and a file by its own label", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build({}, [FRONT_AGENT])
        const file = zaloMessage({ text: "", attachments: [{ kind: "file", url: "https://cdn.test/f.pdf", thumbnailUrl: "", name: "", localPath: "" }] })

        await service.acceptZalo(CONNECTION, { ...picture, text: "" }, manager, [])
        await service.acceptZalo(CONNECTION, file, manager, [])

        expect(messages.storeCustomer).toHaveBeenNthCalledWith(1, "ws-1", "conv-1", "<conversations.imageLabel>", manager)
        expect(messages.storeCustomer).toHaveBeenNthCalledWith(2, "ws-1", "conv-1", "<conversations.fileLabel>", manager)
    })

    it("still reaches the turn when no file could be read", async () => {
        const manager = mockEntityManager()
        const { service, intake, inboundFiles } = await build({}, [FRONT_AGENT])

        await expect(service.acceptZalo(CONNECTION, picture, manager)).resolves.toBe(true)

        expect(inboundFiles.keep).not.toHaveBeenCalled()
        expect(intake.answer).toHaveBeenCalledTimes(1)
    })

    it("keeps the label and the caption in the inbox when no agent is bound", async () => {
        const manager = mockEntityManager()
        const { service, inboundEvents, inboundFiles } = await build({}, [])

        await expect(service.acceptZalo(CONNECTION, picture, manager, [receipt])).resolves.toBe(false)

        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, expect.objectContaining({ body: "<conversations.imageLabel> Em chuyen khoan roi" }))
        expect(inboundFiles.keep).not.toHaveBeenCalled()
    })

    it("reads the files before the message is stored, leaving out the ones that cannot be read", async () => {
        const { service, inboundFiles } = await build({}, [FRONT_AGENT])
        inboundFiles.download.mockResolvedValueOnce(receipt).mockResolvedValueOnce(null)

        const read = await service.readFiles(
            [
                { kind: "image", url: "https://cdn.test/a.png", thumbnailUrl: "", name: "", localPath: "" },
                { kind: "image", url: "https://cdn.test/b.png", thumbnailUrl: "", name: "", localPath: "" },
            ],
            true,
            "m-9",
        )

        expect(read).toEqual([receipt])
        expect(inboundFiles.download).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: "https://cdn.test/a.png" }), true, "m-9", 0)
        expect(inboundFiles.download).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: "https://cdn.test/b.png" }), true, "m-9", 1)
    })
}

const registerZaloEventTime = () => {
    const BURST_AT = new Date(NOW).getTime() - 60_000

    it("stores a message at the time the event says it was sent, with a stable tie-break from its id", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build({}, [FRONT_AGENT])

        await service.acceptZalo(CONNECTION, zaloMessage({ sentAt: BURST_AT }), manager)

        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager, null, {
            at: new Date(BURST_AT),
            tieMicros: expect.any(Number),
        })
        const stamp = messages.storeCustomer.mock.calls[0]?.[5]
        expect(stamp?.tieMicros).toBeGreaterThanOrEqual(0)
        expect(stamp?.tieMicros).toBeLessThan(1000)
    })

    it("never stores a message in the future", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build({}, [FRONT_AGENT])

        await service.acceptZalo(CONNECTION, zaloMessage({ sentAt: new Date(NOW).getTime() + 86_400_000 }), manager)

        expect(messages.storeCustomer.mock.calls[0]?.[5]?.at).toEqual(new Date(NOW))
    })

    it("stores a message at the time it arrived when the event carries no time", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build({}, [FRONT_AGENT])

        await service.acceptZalo(CONNECTION, zaloMessage({ sentAt: null }), manager)

        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager)
    })
}

describe("ConversationsService", () => {
    describe("acceptZaloEventTime", registerZaloEventTime)

    describe("acceptZaloAttachments", registerZaloAttachments)

    describe("acceptTelegram", registerTelegramRouting)

    describe("acceptZalo", registerZaloRouting)

    describe("acceptMeta", registerMetaGuards)
})

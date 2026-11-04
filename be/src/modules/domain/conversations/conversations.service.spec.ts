import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import { InboundFilesService } from "@modules/domain/chat-files"
import type { DownloadedChatFile } from "@modules/domain/chat-files"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { FrontAgent, MetaInbound } from "./conversations.contracts"
import { ConversationsService } from "./conversations.service"
import type { Hearing } from "./customer-hearing.contracts"
import { CustomerHearingService } from "./customer-hearing.service"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const CONNECTION = "c-1"
const FRONT_AGENT = { id: "agent-1", greeting: "Welcome!" }

const receipt: DownloadedChatFile = {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    name: "a.png",
    sourceUrl: "https://cdn.test/a.png",
}

const PICTURE = { kind: "image", url: "https://cdn.test/a.png", thumbnailUrl: "", name: "", localPath: "" } as const

/** The hearing of a Telegram message of Minh Tran to the front-door agent. */
const hearingOf = builder<Hearing>({
    workspaceId: "ws-1",
    connectionId: CONNECTION,
    channel: "telegram",
    customerId: "555",
    visitor: "Minh Tran",
    agent: FRONT_AGENT,
    text: "Hello",
    channelEventId: "tg:555:9",
})

/** The hearing of a Zalo message from a new guest. */
const zaloHearingOf = (patch: Partial<Hearing> = {}): Hearing =>
    hearingOf({
        channel: "zalo",
        customerId: "user-1",
        visitor: "<conversations.zaloGuest>",
        channelEventId: "zalo:m-1",
        files: [],
        sentAt: null,
        ...patch,
    })

const known = (patch: Partial<ConversationRef> = {}): ConversationRef => ({
    id: "conv-1",
    agentId: "agent-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    ...patch,
})

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

const zaloSecretOf = (appId: string) => ({
    kind: "ok" as const,
    value: { secret: { appId, appSecret: "s", oaSecret: "o" }, expiresAt: null, workspaceId: "ws-1" },
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
    conversations.archive.mockResolvedValue(undefined)
    const inboundEvents = mock<InboundEventsService>()
    inboundEvents.keepUnrouted.mockResolvedValue(undefined)
    const hearing = mock<CustomerHearingService>()
    hearing.hear.mockResolvedValue(undefined)
    hearing.greet.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => `<${key}>`)
    const zalo = mock<ZaloCredentialsService>()
    const inboundFiles = mock<InboundFilesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: ZaloCredentialsService, useValue: zalo },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: InboundFilesService, useValue: inboundFiles },
            { provide: CustomerHearingService, useValue: hearing },
        ],
    }).compile()
    const service = moduleRef.get(ConversationsService)
    return {
        service,
        bindings,
        agents,
        connections,
        conversations,
        inboundEvents,
        hearing,
        catalog,
        zalo,
        inboundFiles,
    }
}

const registerTelegram = () => {
    it("hands a message to the hearing of the front-door agent with its channel id", async () => {
        const manager = mockEntityManager()
        const { service, hearing } = await build({}, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(hearing.hear).toHaveBeenCalledWith(hearingOf(), manager)
        expect(hearing.greet).not.toHaveBeenCalled()
    })

    it("only keeps the message in the inbox when no agent is bound to the connection", async () => {
        const manager = mockEntityManager()
        const { service, hearing, inboundEvents } = await build({}, [])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            channel: "telegram",
            sender: "Minh Tran",
            body: "Hello",
            eventId: "tg:c-1:555:9",
        })
        expect(hearing.hear).not.toHaveBeenCalled()
    })

    it("ignores a delivery for a connection that is gone", async () => {
        const manager = mockEntityManager()
        const { service, hearing, bindings } = await build({ connection: false }, [FRONT_AGENT])

        await expect(service.acceptTelegram(CONNECTION, telegram(), manager)).resolves.toBeUndefined()
        expect(bindings.routeInbound).not.toHaveBeenCalled()
        expect(hearing.hear).not.toHaveBeenCalled()
    })

    it("opens a new visit on /start: archives the old conversation and greets it", async () => {
        const manager = mockEntityManager()
        const { service, hearing, conversations } = await build({}, [FRONT_AGENT])

        await expect(
            service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager),
        ).resolves.toBeUndefined()
        expect(conversations.archive).toHaveBeenCalledWith("ws-1", "telegram", CONNECTION, "555", `555:${NOW}`, manager)
        const { text: _text, channelEventId: _id, ...meeting } = hearingOf()
        expect(hearing.greet).toHaveBeenCalledWith(meeting, "tg:555:9", manager)
        expect(hearing.hear).not.toHaveBeenCalled()
    })

    it("greets with an empty line when the agent has no greeting, leaving the default to the hearing", async () => {
        const manager = mockEntityManager()
        const { service, hearing, agents } = await build({}, [FRONT_AGENT])
        agents.greetingOf.mockResolvedValue(null)

        await service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager)

        expect(hearing.greet).toHaveBeenCalledWith(
            expect.objectContaining({ agent: { id: "agent-1", greeting: "" } }),
            "tg:555:9",
            manager,
        )
    })
}

const registerZalo = () => {
    it("marks the connection received and hands the message with its files and time to the hearing", async () => {
        const manager = mockEntityManager()
        const { service, hearing, connections, zalo } = await build({}, [FRONT_AGENT])
        zalo.load.mockResolvedValue(zaloSecretOf("app-1"))

        await expect(
            service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1", sentAt: NOW - 1000 }), manager, [receipt]),
        ).resolves.toBe(true)
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            { amount: 0, content: "<conversations.zaloGuest>", at: new Date(NOW).toISOString(), text: "Hello" },
            manager,
        )
        expect(hearing.hear).toHaveBeenCalledWith(zaloHearingOf({ files: [receipt], sentAt: NOW - 1000 }), manager)
    })

    it("keeps the name of a known customer and cuts the first event text at 160 characters", async () => {
        const manager = mockEntityManager()
        const { service, connections, hearing } = await build({ existing: known() }, [FRONT_AGENT])

        await expect(service.acceptZalo(CONNECTION, zaloMessage({ text: "x".repeat(300) }), manager)).resolves.toBe(
            true,
        )
        expect(connections.markReceived).toHaveBeenCalledWith(
            CONNECTION,
            expect.objectContaining({ content: "Minh", text: "x".repeat(160) }),
            manager,
        )
        expect(hearing.hear).toHaveBeenCalledWith(zaloHearingOf({ visitor: "Minh", text: "x".repeat(300) }), manager)
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

    it("reaches the hearing as the label of a picture and its caption, the label alone, or a file's own label", async () => {
        const manager = mockEntityManager()
        const { service, hearing } = await build({}, [FRONT_AGENT])
        const file = { ...PICTURE, kind: "file", url: "https://cdn.test/f.pdf" }

        await service.acceptZalo(
            CONNECTION,
            zaloMessage({ text: "Em chuyen khoan roi", attachments: [PICTURE] }),
            manager,
        )
        await service.acceptZalo(CONNECTION, zaloMessage({ text: "", attachments: [PICTURE] }), manager)
        await service.acceptZalo(CONNECTION, zaloMessage({ text: "", attachments: [file] }), manager)

        const texts = hearing.hear.mock.calls.map(([heard]) => heard.text)
        expect(texts).toEqual([
            "<conversations.imageLabel> Em chuyen khoan roi",
            "<conversations.imageLabel>",
            "<conversations.fileLabel>",
        ])
    })
}

const registerZaloInbox = () => {
    it("only keeps the message, with the label of its picture, in the inbox when no agent is bound", async () => {
        const manager = mockEntityManager()
        const { service, hearing, inboundEvents } = await build({}, [])

        await expect(
            service.acceptZalo(CONNECTION, zaloMessage({ attachments: [PICTURE] }), manager, [receipt]),
        ).resolves.toBe(false)
        expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            channel: "zalo",
            sender: "<conversations.zaloGuest>",
            body: "<conversations.imageLabel> Hello",
            eventId: "zalo:c-1:m-1",
        })
        expect(hearing.hear).not.toHaveBeenCalled()
    })

    it("ignores an event for another Zalo app and one for a connection that is gone", async () => {
        const other = await build({}, [FRONT_AGENT])
        other.zalo.load.mockResolvedValue(zaloSecretOf("app-2"))
        const gone = await build({ connection: false })

        await expect(
            other.service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), mockEntityManager()),
        ).resolves.toBe(false)
        await expect(gone.service.acceptZalo(CONNECTION, zaloMessage(), mockEntityManager())).resolves.toBe(false)
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

    it("reads the files before the message is stored, leaving out the ones that cannot be read", async () => {
        const { service, inboundFiles } = await build({}, [FRONT_AGENT])
        inboundFiles.download.mockResolvedValueOnce(receipt).mockResolvedValueOnce(null)
        const second = { ...PICTURE, url: "https://cdn.test/b.png" }

        await expect(service.readFiles([PICTURE, second], true, "m-9")).resolves.toEqual([receipt])
        expect(inboundFiles.download).toHaveBeenNthCalledWith(1, PICTURE, true, "m-9", 0)
        expect(inboundFiles.download).toHaveBeenNthCalledWith(2, second, true, "m-9", 1)
    })
}

const registerMeta = () => {
    it("ignores a delivery for a refused connection", async () => {
        const manager = mockEntityManager()
        const { service, connections, bindings, hearing, inboundEvents, catalog } = await build({ connection: false }, [
            FRONT_AGENT,
        ])

        await expect(service.acceptMeta(CONNECTION, metaMessage(), manager)).resolves.toBeUndefined()
        expect(connections.intakeOf).toHaveBeenCalledWith(CONNECTION, "meta", manager)
        expect(bindings.routeInbound).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
        expect(inboundEvents.keepUnrouted).not.toHaveBeenCalled()
        expect(hearing.hear).not.toHaveBeenCalled()
    })

    it.each(["facebook", "instagram"] as const)(
        "hands a %s message of the person to the hearing with its event id",
        async (platform) => {
            const manager = mockEntityManager()
            const { service, hearing, inboundEvents, catalog } = await build({}, [FRONT_AGENT])

            await expect(service.acceptMeta(CONNECTION, metaMessage({ platform }), manager)).resolves.toBeUndefined()
            expect(hearing.hear).toHaveBeenCalledWith(
                hearingOf({ channel: platform, customerId: "person-1", channelEventId: "meta:event-1" }),
                manager,
            )
            expect(catalog.get).not.toHaveBeenCalled()
            expect(inboundEvents.keepUnrouted).not.toHaveBeenCalled()
        },
    )

    it.each(["facebook", "instagram"] as const)(
        "names an unnamed %s person by the guest line, routed or kept in the inbox with its connection-scoped event id",
        async (platform) => {
            const routed = await build({}, [FRONT_AGENT])
            const unrouted = await build({}, [])
            const manager = mockEntityManager()

            await routed.service.acceptMeta(CONNECTION, metaMessage({ platform, visitor: null }), manager)
            await unrouted.service.acceptMeta(CONNECTION, metaMessage({ platform, visitor: null }), manager)

            expect(routed.hearing.hear).toHaveBeenCalledWith(
                expect.objectContaining({ visitor: `<conversations.${platform}Guest>` }),
                manager,
            )
            expect(unrouted.inboundEvents.keepUnrouted).toHaveBeenCalledWith(manager, {
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
        const { service, hearing, catalog } = await build({}, [FRONT_AGENT])

        await expect(service.acceptMeta(CONNECTION, metaMessage({ visitor: "" }), manager)).resolves.toBeUndefined()
        expect(catalog.get).not.toHaveBeenCalled()
        expect(hearing.hear).toHaveBeenCalledWith(expect.objectContaining({ visitor: "" }), manager)
    })
}

describe("ConversationsService", () => {
    describe("acceptTelegram", registerTelegram)

    describe("acceptZalo", registerZalo)

    describe("acceptZalo inbox and files", registerZaloInbox)

    describe("acceptMeta", registerMeta)
})

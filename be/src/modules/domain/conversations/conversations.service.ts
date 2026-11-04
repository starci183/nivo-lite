import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { InboundFilesService } from "@modules/domain/chat-files"
import type { DownloadedChatFile } from "@modules/domain/chat-files"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { IntakeConnection } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { CustomerHearingService } from "./customer-hearing.service"
import type { Meeting } from "./customer-hearing.contracts"
import type {
    FrontAgent,
    InboundAttachment,
    MetaInbound,
    TelegramInbound,
    ZaloInbound,
} from "./conversations.contracts"

const LOCALE = "vi"

@Injectable()
/**
 * Turns a verified delivery of a messaging channel into the stored conversation and the job or wake that answers it, on the road the
 * workspace is on. It runs inside the transaction of the webhook inbox, so the message and its answer exist together or not at all. A
 * connection with nobody bound only stores the message in the inbox.
 */
export class ConversationsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly connections: ConnectionsService,
        private readonly conversations: AgentConversationsService,
        private readonly inboundEvents: InboundEventsService,
        private readonly zaloCredentials: ZaloCredentialsService,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentDirectoryService,
        private readonly inboundFiles: InboundFilesService,
        private readonly hearing: CustomerHearingService,
    ) {}

    /** One Telegram message: answered by the front-door agent of the connection, or only stored when none is bound. "/start" opens a new visit with the greeting. */
    async acceptTelegram(connectionId: string, inbound: TelegramInbound, manager: EntityManager): Promise<void> {
        const connection = await this.connections.intakeOf(connectionId, "telegram", manager)
        if (connection.kind !== "ok") return
        const channelEventId = `tg:${inbound.chatId}:${inbound.messageId}`
        const agent = await this.frontAgentOf(connection.value.workspaceId, connectionId)
        if (agent === undefined) {
            await this.keepUnrouted(
                connection.value,
                "telegram",
                inbound.visitor,
                inbound.text,
                `tg:${connectionId}:${inbound.chatId}:${inbound.messageId}`,
                manager,
            )
            return
        }
        const meeting: Meeting = {
            workspaceId: connection.value.workspaceId,
            connectionId,
            channel: "telegram",
            customerId: inbound.chatId,
            visitor: inbound.visitor,
            agent,
        }
        if (!inbound.isStart) {
            await this.hearing.hear({ ...meeting, text: inbound.text, channelEventId }, manager)
            return
        }
        await this.conversations.archive(
            meeting.workspaceId,
            meeting.channel,
            connectionId,
            inbound.chatId,
            `${inbound.chatId}:${this.clock.now().getTime()}`,
            manager,
        )
        await this.hearing.greet(meeting, channelEventId, manager)
    }

    /**
     * One Zalo text message: the connection turns connected on its first event, then the message is answered or only stored like a Telegram one.
     * Answers true when it went to the agent turn of its conversation or to the person who owns it, false when it was only kept or not for this connection.
     */
    async acceptZalo(
        connectionId: string,
        inbound: ZaloInbound,
        manager: EntityManager,
        files: ReadonlyArray<DownloadedChatFile> = [],
    ): Promise<boolean> {
        const words = this.wordsOf(inbound)
        const connection = await this.connections.intakeOf(connectionId, "zalo_oa", manager)
        if (connection.kind !== "ok" || (await this.isOtherApp(connectionId, inbound.appId))) return false
        const workspaceId = connection.value.workspaceId
        const known = await this.conversations.find(workspaceId, "zalo", connectionId, inbound.userId, manager)
        const visitor =
            (known.kind === "ok" ? known.value.visitorName : null) ??
            this.catalog.get("conversations.zaloGuest", {}, LOCALE)
        await this.connections.markReceived(
            connectionId,
            { amount: 0, content: visitor, at: this.clock.now().toISOString(), text: inbound.text.slice(0, 160) },
            manager,
        )
        const agent = await this.frontAgentOf(connection.value.workspaceId, connectionId)
        if (agent === undefined) {
            await this.keepUnrouted(
                connection.value,
                "zalo",
                visitor,
                words,
                `zalo:${connectionId}:${inbound.messageId}`,
                manager,
            )
            return false
        }
        await this.hearing.hear(
            {
                workspaceId,
                connectionId,
                channel: "zalo",
                customerId: inbound.userId,
                visitor,
                agent,
                text: words,
                channelEventId: `zalo:${inbound.messageId}`,
                files,
                sentAt: inbound.sentAt,
            },
            manager,
        )
        return true
    }

    /**
     * Reads the pictures and files of a message before it is stored, so no download happens inside the database transaction that stores it. One that
     * cannot be read, is too large or is not an accepted type is left out (and logged): the message still reaches its turn. `imported` is true only for a
     * row of a manual import, the one source whose attachments may name a local file.
     */
    async readFiles(
        attachments: ReadonlyArray<InboundAttachment>,
        imported: boolean,
        ref: string,
    ): Promise<ReadonlyArray<DownloadedChatFile>> {
        const read: Array<DownloadedChatFile> = []
        await eachInOrder(attachments, async (attachment, index) => {
            const file = await this.inboundFiles.download(attachment, imported, ref, index)
            if (file !== null) read.push(file)
        })
        return read
    }

    /** One Facebook or Instagram direct message: answered by the front-door agent of the connection, or only stored when none is bound. */
    async acceptMeta(connectionId: string, inbound: MetaInbound, manager: EntityManager): Promise<void> {
        const connection = await this.connections.intakeOf(connectionId, "meta", manager)
        if (connection.kind !== "ok") return
        const visitor = inbound.visitor ?? this.catalog.get(`conversations.${inbound.platform}Guest`, {}, LOCALE)
        const agent = await this.frontAgentOf(connection.value.workspaceId, connectionId)
        const eventId = `meta:${inbound.eventId}`
        if (agent === undefined) {
            await this.keepUnrouted(
                connection.value,
                inbound.platform,
                visitor,
                inbound.text,
                `${eventId}:${connectionId}`,
                manager,
            )
            return
        }
        await this.hearing.hear(
            {
                workspaceId: connection.value.workspaceId,
                connectionId,
                channel: inbound.platform,
                customerId: inbound.personId,
                visitor,
                agent,
                text: inbound.text,
                channelEventId: eventId,
            },
            manager,
        )
    }

    /** What the customer wrote as the turn reads it: the text, or a label for the picture or file with its caption after it. */
    private wordsOf(inbound: ZaloInbound): string {
        const first = inbound.attachments[0]
        if (first === undefined) return inbound.text
        const label = this.catalog.get(
            first.kind === "image" ? "conversations.imageLabel" : "conversations.fileLabel",
            {},
            LOCALE,
        )
        return `${label} ${inbound.text}`.trim()
    }

    private async keepUnrouted(
        connection: IntakeConnection,
        channel: string,
        sender: string,
        body: string,
        eventId: string,
        manager: EntityManager,
    ): Promise<void> {
        await this.inboundEvents.keepUnrouted(manager, {
            workspaceId: connection.workspaceId,
            channel,
            sender,
            body,
            eventId,
        })
    }

    private async isOtherApp(connectionId: string, appId: string): Promise<boolean> {
        if (appId === "") return false
        const loaded = await this.zaloCredentials.load(connectionId)
        return loaded.kind === "ok" && loaded.value.secret.appId !== appId
    }

    private async frontAgentOf(workspaceId: string, connectionId: string): Promise<FrontAgent | undefined> {
        const { front } = await this.bindings.routeInbound(connectionId)
        if (front === null) return undefined
        return { id: front.id, greeting: (await this.agents.greetingOf(workspaceId, front.id)) ?? "" }
    }
}

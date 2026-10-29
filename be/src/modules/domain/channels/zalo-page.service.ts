import { Injectable } from "@nestjs/common"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ZaloInboxPageReadService } from "@modules/domain/zalo-inbox"
import { AgentMessagesFeedReadService } from "@modules/domain/agent-messages"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import type { ConnectionConversation } from "@modules/domain/agent-conversations"
import { zaloFailureOf } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { LoadedZalo } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import type { LastReplyRow, MessageEventRow, RecipientRow } from "./persistence/zalo-page.rows"
import type { ZaloPageEvent, ZaloPageView, ZaloTestSendResult } from "./zalo-page.contracts"
import { checksOf, eventsOf, maskTail, recipientsOf, sendBlockOf, tokenUsable, tokenViewOf } from "./zalo-page.policy"
import { ZALO_FREE_WINDOW_MS } from "./zalo-delivery.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { znsRenewalOf } from "./zns-renewal.policy"

/** The channel of the conversations this page lists. */
const ZALO_CHANNEL = "zalo"

/** The most conversations of one connection the page looks across. */
const CONVERSATIONS_MAX = 500

/** The most events and recipients the page lists. */
const EVENTS_MAX = 40
const RECIPIENTS_MAX = 40

const MANAGER = ["owner", "manager"] as const
const PROVIDER = "zalo_oa"
const TEXT_MAX = 500

const invalid = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

@Injectable()
/**
 * The read model and the two actions of the page of one Zalo OA connection: the check list, the followers a test message can reach, the
 * live events, the re-check and the real test send. Every secret leaves masked to its last four characters; no token leaves at all.
 */
export class ZaloPageService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly delivery: ChannelDeliveryService,
        private readonly inboxReads: ZaloInboxPageReadService,
        private readonly conversations: AgentConversationsReadService,
        private readonly feed: AgentMessagesFeedReadService,
    ) {}

    /** The page of a Zalo connection (owner or manager). */
    async view(actor: ConnectionActor, connectionId: string): Promise<ZaloPageView> {
        await this.connections.authorize(actor, MANAGER)
        return this.viewOf(actor, await this.zaloOf(actor, connectionId))
    }

    /** The live events of a Zalo connection, newest first (owner or manager). */
    async events(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<ZaloPageEvent>> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.zaloOf(actor, connectionId)
        const token = await this.tokenOf(connection)
        const conversations = await this.conversations.onConnection(
            actor.workspaceId,
            connection.id,
            ZALO_CHANNEL,
            CONVERSATIONS_MAX,
        )
        const [feed, follows] = await Promise.all([
            this.feed.recentIn(
                conversations.map((conversation) => conversation.id),
                EVENTS_MAX,
            ),
            this.inboxReads.followEvents(connection.id),
        ])
        const nameOf = new Map(conversations.map((conversation) => [conversation.id, conversation.visitorName]))
        const messages = feed.map((message): MessageEventRow => ({
            id: message.id,
            role: message.role,
            body: message.body,
            created_at: message.createdAt,
            delivery_status: message.deliveryStatus,
            delivery_error: message.deliveryError,
            visitor_name: nameOf.get(message.conversationId) ?? null,
        }))
        return eventsOf(messages, follows, token.view)
    }

    /**
     * Runs the check again (owner or manager): an access token that ended is renewed now when a live refresh token can, so the verdict
     * is the one a real send would meet. A refusal from Zalo marks the connection failing, as on any use of the token.
     */
    async recheck(actor: ConnectionActor, connectionId: string): Promise<ZaloPageView> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.zaloOf(actor, connectionId)
        await this.credentials.accessToken(connection.id).catch((cause: unknown) => {
            if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) throw cause
            this.logger.warn(ChannelsLogEvent.ZaloRefreshFailed, { connectionId, reason: String(cause) })
        })
        return this.viewOf(actor, await this.zaloOf(actor, connectionId))
    }

    /** Sends a real test text through the delivery path to a follower who wrote within the free window (owner or manager). */
    async sendTest(
        actor: ConnectionActor,
        connectionId: string,
        recipientId: string,
        text: string,
    ): Promise<ZaloTestSendResult> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.zaloOf(actor, connectionId)
        const body = text.trim()
        if (body.length === 0 || body.length > TEXT_MAX) invalid("text")
        const conversations = await this.conversations.onConnection(
            actor.workspaceId,
            connection.id,
            ZALO_CHANNEL,
            CONVERSATIONS_MAX,
        )
        const recipients = await this.recipientsOf(conversations)
        if (!recipients.some((one) => one.userId === recipientId)) invalid("recipientId")
        return this.delivery
            .sendToPerson({
                workspaceId: actor.workspaceId,
                connectionId: connection.id,
                provider: PROVIDER,
                recipientId,
                text: body,
            })
            .then(
                (): ZaloTestSendResult => ({ sent: true, failure: null }),
                (cause: unknown): ZaloTestSendResult => {
                    if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) throw cause
                    this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, { connectionId, channel: "zalo" })
                    return { sent: false, failure: this.failureOf(cause) }
                },
            )
    }

    private failureOf(cause: unknown): string {
        if (cause instanceof ChannelsError) return "token_expired"
        return zaloFailureOf(cause)
    }

    private async viewOf(actor: ConnectionActor, connection: ConnectionRecord): Promise<ZaloPageView> {
        const loaded = await this.tokenOf(connection)
        const secret = loaded.secret
        const conversations = await this.conversations.onConnection(
            actor.workspaceId,
            connection.id,
            ZALO_CHANNEL,
            CONVERSATIONS_MAX,
        )
        const [recipients, inbox, lastReply, agentIds] = await Promise.all([
            this.recipientsOf(conversations),
            this.inboxReads.factsOf(connection.id),
            this.lastReplyOf(conversations),
            this.connections.agentIds(actor.workspaceId, connection.id),
        ])
        const token = loaded.view
        const appSaved = secret !== null && secret.appId !== "" && secret.appSecret !== ""
        const oaSecretSaved = secret !== null && secret.oaSecret !== ""
        return {
            id: connection.id,
            name: connection.name,
            status: connection.status,
            healthy: connection.status === "connected" && tokenUsable(token),
            oaId: connection.meta.oa_id ?? "",
            appId: secret?.appId ?? connection.meta.app_id ?? "",
            appSecretMask: maskTail(secret?.appSecret ?? ""),
            oaSecretMask: maskTail(secret?.oaSecret ?? ""),
            callbackUrl: this.credentials.callbackUrl(),
            webhookUrl: this.connections.webhookUrl(PROVIDER, connection.id),
            access: token,
            checks: checksOf({ appSaved, oaSecretSaved, token, inbox, lastReply }),
            recipients,
            sendBlock: sendBlockOf(token, recipients.length),
            agentIds,
            znsRenewal: znsRenewalOf(connection.meta),
        }
    }

    private async recipientsOf(conversations: ReadonlyArray<ConnectionConversation>) {
        const since = new Date(this.clock.now().getTime() - ZALO_FREE_WINDOW_MS)
        const writes = await this.feed.lastWritesSince(
            conversations.map((conversation) => conversation.id),
            since,
            RECIPIENTS_MAX,
        )
        const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]))
        const rows = writes.flatMap((write): Array<RecipientRow> => {
            const conversation = byId.get(write.conversationId)
            return conversation?.externalId === undefined || conversation.externalId === null
                ? []
                : [
                      {
                          external_id: conversation.externalId,
                          visitor_name: conversation.visitorName,
                          last_at: write.lastAt,
                      },
                  ]
        })
        return recipientsOf(rows)
    }

    /** The verdict of the newest agent reply on the connection whose delivery was tried, or null. */
    private async lastReplyOf(conversations: ReadonlyArray<ConnectionConversation>): Promise<LastReplyRow | null> {
        const reply = await this.feed.lastDeliveredReplyIn(conversations.map((conversation) => conversation.id))
        return reply === null ? null : { delivery_status: reply.deliveryStatus, delivery_error: reply.deliveryError }
    }

    private async tokenOf(connection: ConnectionRecord) {
        const loaded = await this.credentials.load(connection.id)
        const now = this.clock.now().getTime()
        const secret = loaded.kind === "ok" ? loaded.value.secret : null
        const empty: LoadedZalo["secret"] = { appId: "", appSecret: "", oaSecret: "" }
        return {
            secret,
            view: tokenViewOf(
                secret ?? empty,
                loaded.kind === "ok" ? loaded.value.expiresAt : null,
                connection.status,
                now,
            ),
        }
    }

    private async zaloOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.provider !== PROVIDER) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        }
        return connection
    }
}

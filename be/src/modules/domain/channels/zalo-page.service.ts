import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ZaloInboxEntity } from "@modules/domain/zalo-inbox/persistence/entities"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { zaloFailureOf } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { LoadedZalo } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import type {
    FollowEventRow,
    InboxFactsRow,
    LastReplyRow,
    MessageEventRow,
    RecipientRow,
} from "./persistence/zalo-page.rows"

/** The Zalo conversations of a connection, which both message reads filter by. */
const ZALO_CONVERSATION = "c.workspace_id = :workspaceId AND c.connection_id = :connectionId AND c.channel = 'zalo'"

/** The webhook body test for one event name, as the inbox stores the raw body. */
const eventNamed = (event: string): string =>
    `i.payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"${event}"'`
import type { ZaloPageEvent, ZaloPageView, ZaloTestSendResult } from "./zalo-page.contracts"
import { checksOf, eventsOf, maskTail, recipientsOf, sendBlockOf, tokenUsable, tokenViewOf } from "./zalo-page.policy"
import { ZALO_FREE_WINDOW_MS } from "./zalo-delivery.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { znsRenewalOf } from "./zns-renewal.policy"

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
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly delivery: ChannelDeliveryService,
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
        const [messages, follows] = await Promise.all([
            this.entityManager
                .createQueryBuilder(AgentMessageEntity, "m")
                .select("m.id", "id")
                .addSelect("m.role", "role")
                .addSelect("m.body", "body")
                .addSelect("m.created_at::text", "created_at")
                .addSelect("m.delivery_status", "delivery_status")
                .addSelect("m.delivery_error", "delivery_error")
                .addSelect("c.visitor_name", "visitor_name")
                .innerJoin(AgentConversationEntity, "c", "c.id = m.conversation_id")
                .where(ZALO_CONVERSATION, { workspaceId: actor.workspaceId, connectionId: connection.id })
                .andWhere("m.role IN ('user', 'agent')")
                .orderBy("m.created_at", "DESC")
                .limit(40)
                .getRawMany<MessageEventRow>(),
            this.entityManager
                .createQueryBuilder(ZaloInboxEntity, "i")
                .select("i.id", "id")
                .addSelect("i.received_at::text", "received_at")
                .where("i.payload->>'connection' = :connectionId", { connectionId: connection.id })
                .andWhere(eventNamed("follow"))
                .orderBy("i.received_at", "DESC")
                .limit(20)
                .getRawMany<FollowEventRow>(),
        ])
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
        const recipients = await this.recipientsOf(actor.workspaceId, connection.id)
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
        const [recipients, inbox, lastReply, agentIds] = await Promise.all([
            this.recipientsOf(actor.workspaceId, connection.id),
            this.entityManager
                .createQueryBuilder(ZaloInboxEntity, "i")
                .select("max(i.received_at)::text", "last_at")
                .addSelect(`coalesce(bool_or(${eventNamed("user_send_text")}), false)`, "has_text")
                .addSelect(`coalesce(bool_or(${eventNamed("follow")}), false)`, "has_follow")
                .where("i.payload->>'connection' = :connectionId", { connectionId: connection.id })
                .getRawMany<InboxFactsRow>()
                .then((rows) => rows[0] ?? null),
            this.entityManager
                .createQueryBuilder(AgentMessageEntity, "m")
                .select("m.delivery_status", "delivery_status")
                .addSelect("m.delivery_error", "delivery_error")
                .innerJoin(AgentConversationEntity, "c", "c.id = m.conversation_id")
                .where(ZALO_CONVERSATION, { workspaceId: actor.workspaceId, connectionId: connection.id })
                .andWhere("m.role = 'agent' AND m.delivery_status IS NOT NULL")
                .orderBy("m.created_at", "DESC")
                .limit(1)
                .getRawMany<LastReplyRow>()
                .then((rows) => rows[0] ?? null),
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

    private async recipientsOf(workspaceId: string, connectionId: string) {
        const since = new Date(this.clock.now().getTime() - ZALO_FREE_WINDOW_MS).toISOString()
        const rows = await this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select("c.external_id", "external_id")
            .addSelect("c.visitor_name", "visitor_name")
            .addSelect("max(m.created_at)::text", "last_at")
            .innerJoin(AgentMessageEntity, "m", "m.conversation_id = c.id AND m.role = 'user'")
            .where(ZALO_CONVERSATION, { workspaceId, connectionId })
            .andWhere("c.external_id IS NOT NULL AND m.created_at > :since::timestamptz", { since })
            .groupBy("c.id")
            .orderBy("max(m.created_at)", "DESC")
            .limit(40)
            .getRawMany<RecipientRow>()
        return recipientsOf(rows)
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

import { Injectable } from "@nestjs/common"
import type { StartZaloInput, ZaloWizardConnection } from "@modules/domain/channel-connections"
import { ConnectionSecretsService, randomSecret } from "@modules/domain/connection-secrets"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { isZaloRefusal } from "@modules/integrations/zalo"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloAuthorization, ZaloReturn } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError } from "./errors/channels.error"
import { ZALO_AUTHORIZATION_FAILED_REASON } from "./messages/channels.messages"
import { ZaloCredentialsService } from "./zalo-credentials.service"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
const PROVIDER = "zalo_oa"
const APP_ID = /^[0-9]{6,30}$/u
const KEY_MIN = 8
const KEY_MAX = 200

const invalid = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

const flag = (meta: Readonly<Record<string, unknown>>, key: string): boolean => String(meta[key]) === "true"

@Injectable()
/**
 * The Zalo OA connection wizard the owner drives from the browser: the app keys are sealed at once, the OA Secret Key is added later, and the
 * permission page and its return are handled for the caller. No key is ever returned.
 */
export class ZaloConnectService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly secrets: ConnectionSecretsService,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Creates the pending connection with the Zalo app keys sealed (owner). */
    async start(actor: ConnectionActor, input: StartZaloInput): Promise<ZaloWizardConnection> {
        await this.connections.authorize(actor, OWNER)
        const appId = input.appId.trim()
        const appSecret = input.appSecret.trim()
        if (!APP_ID.test(appId)) invalid("appId")
        if (appSecret.length < KEY_MIN) invalid("appSecret")
        // The OA secret key is copied later, from the Webhook screen; until then every webhook is refused (a blank key never verifies).
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: PROVIDER,
            name: input.name,
            status: "pending",
            environment: "live",
            meta: { app_id: appId },
            secret: { plain: JSON.stringify({ appId, appSecret, oaSecret: "" }), webhookSecret: randomSecret() },
        })
        return this.viewOf(await this.connections.get(actor.workspaceId, id))
    }

    /** Seals the OA Secret Key that signs every webhook of the connection (owner). */
    async saveOaSecret(actor: ConnectionActor, connectionId: string, oaSecret: string): Promise<ZaloWizardConnection> {
        await this.connections.authorize(actor, OWNER)
        const key = oaSecret.trim()
        if (key.length < KEY_MIN || key.length > KEY_MAX) invalid("oaSecret")
        const connection = await this.zaloOf(actor, connectionId)
        const loaded = await this.credentials.load(connection.id)
        if (loaded.kind !== "ok")
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        await this.secrets.save(
            connection.id,
            this.secrets.seal(JSON.stringify({ ...loaded.value.secret, oaSecret: key })),
        )
        await this.connections.patch(actor.workspaceId, connection.id, {
            meta: { ...connection.meta, oa_secret_saved: "true" },
        })
        return this.viewOf(await this.connections.get(actor.workspaceId, connection.id))
    }

    /** The wizard view of a Zalo connection (owner or manager). */
    async view(actor: ConnectionActor, connectionId: string): Promise<ZaloWizardConnection> {
        await this.connections.authorize(actor, MANAGER)
        return this.viewOf(await this.zaloOf(actor, connectionId))
    }

    /** Starts the Zalo sign-in of the OA: the permission page to open (owner). */
    async authorize(actor: ConnectionActor, connectionId: string): Promise<ZaloAuthorization> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.zaloOf(actor, connectionId)
        return this.credentials.beginAuthorization(actor.workspaceId, connection.id)
    }

    /**
     * Finishes the sign-in with what Zalo returned the browser with (owner or manager). A state or code that is refused marks the connection failing
     * for the owner to see and is thrown back; the one-time code cannot be tried twice.
     */
    async finishAuthorization(actor: ConnectionActor, input: ZaloReturn): Promise<ZaloWizardConnection> {
        await this.connections.authorize(actor, MANAGER)
        const connectionId = await this.credentials
            .completeAuthorization(actor.workspaceId, input)
            .catch(async (cause: unknown) => {
                if (cause instanceof ChannelsError || isZaloRefusal(cause)) {
                    const failing = input.state.split(".")[0] ?? ""
                    this.logger.error(ChannelsLogEvent.ZaloAuthorizationRefused, cause, { connectionId: failing })
                    const own = await this.connections.find(actor.workspaceId, failing)
                    if (own !== null) await this.connections.markFailing(own.id, ZALO_AUTHORIZATION_FAILED_REASON)
                }
                throw cause
            })
        return this.viewOf(await this.connections.get(actor.workspaceId, connectionId))
    }

    private async zaloOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.provider !== PROVIDER) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        }
        return connection
    }

    private async viewOf(connection: ConnectionRecord): Promise<ZaloWizardConnection> {
        return {
            id: connection.id,
            name: connection.name,
            status: connection.status,
            webhookUrl: this.connections.webhookUrl(PROVIDER, connection.id),
            callbackUrl: this.credentials.callbackUrl(),
            authorized: flag(connection.meta, "authorized"),
            oaSecretSaved: flag(connection.meta, "oa_secret_saved"),
            oaId: connection.meta.oa_id ?? "",
            firstEvent: connection.firstEvent,
            agentIds: await this.connections.agentIds(connection.workspaceId, connection.id),
        }
    }
}

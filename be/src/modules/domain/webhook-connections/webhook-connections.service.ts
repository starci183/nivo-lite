import { Injectable } from "@nestjs/common"
import {
    ConnectionsError,
    ConnectionsErrorCode,
    ConnectionsService,
    cleanConnectionName,
    type ConnectionActor,
    type ConnectionRecord,
} from "@modules/domain/connections"
import { randomSecret } from "@modules/domain/connection-secrets"
import {
    InjectWebhookDeliveryClient,
    WebhookDeliveryError,
    type WebhookDeliveryClient,
} from "@modules/integrations/webhook-delivery"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { parseJsonText } from "@modules/platform/primitives"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import type {
    CreatedWebhook,
    StartWebhookInput,
    WebhookTestResult,
    WebhookView,
} from "./webhook-connections.contracts"
import { InjectWebhookConnectionsOptions } from "./webhook-connections.decorators"
import type { WebhookConnectionsOptions } from "./webhook-connections.options"
import { installedWebhookEvents, type WebhookEventOption } from "./webhook-events.catalogue"
import { eventsOf, pickEvents, signDelivery, workspaceSigningSecret } from "./webhook-signing.policy"
import { maskedWebhookUrl } from "./webhook-url-mask.policy"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const

const LAST_FOUR = 4

const lastFour = (secret: string): string => secret.slice(-LAST_FOUR)

const idsOf = (options: ReadonlyArray<WebhookEventOption>): Array<string> => options.map((option) => option.id)

@Injectable()
/**
 * The n8n / Webhook connection (provider webhook): the owner enters a URL and picks events; NIVO shows the signing secret (derived
 * per workspace, the key the console signs deliveries with) and can send a signed sample event. The URL is stored sealed, the picked
 * events in the public facts.
 */
export class WebhookConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectWebhookDeliveryClient() private readonly delivery: WebhookDeliveryClient,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectWebhookConnectionsOptions() private readonly options: WebhookConnectionsOptions,
    ) {}

    /** Creates the connection as PENDING and returns the signing secret to copy: this answer is the only place it is shown whole. */
    async start(actor: ConnectionActor, input: StartWebhookInput): Promise<CreatedWebhook> {
        await this.connections.authorize(actor, OWNER)
        const name = cleanConnectionName(input.name)
        if (name === null) throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NameInvalid })
        const events = this.requireEvents(input.events)
        const target = await this.target(input.url)
        const signingSecret = this.requireSigning(actor.workspaceId)
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: "webhook",
            name,
            status: "pending",
            environment: "live",
            meta: { host: target.host, events: events.join(","), url_masked: maskedWebhookUrl(target) },
            secret: { plain: JSON.stringify({ url: target.toString() }), webhookSecret: randomSecret() },
        })
        return { id, name, host: target.host, events, signingSecret, signingSecretLast4: lastFour(signingSecret) }
    }

    /** The events a webhook receiver may pick now: the ones the installed plugins declare and the engine's own, each with its name. */
    async availableEvents(actor: ConnectionActor): Promise<ReadonlyArray<WebhookEventOption>> {
        await this.connections.authorize(actor, OWNER)
        return installedWebhookEvents()
    }

    /** Shows the host and the chosen events again, with the signing secret masked to its last four characters. */
    async view(actor: ConnectionActor, connectionId: string): Promise<WebhookView> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.ownWebhook(actor, connectionId)
        return {
            id: connection.id,
            name: connection.name,
            host: connection.meta.host ?? "",
            events: eventsOf(connection.meta, idsOf(installedWebhookEvents())),
            signingSecretLast4: lastFour(this.requireSigning(actor.workspaceId)),
        }
    }

    /** Changes which events a webhook connection receives. */
    async updateEvents(
        actor: ConnectionActor,
        connectionId: string,
        events: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.ownWebhook(actor, connectionId)
        const picked = this.requireEvents(events)
        await this.connections.patch(actor.workspaceId, connection.id, {
            meta: { ...connection.meta, events: picked.join(",") },
        })
        return picked
    }

    /** POSTs a signed sample event (same headers and signature as a real delivery) and reports what the receiver answered. */
    async test(actor: ConnectionActor, connectionId: string): Promise<WebhookTestResult> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.ownWebhook(actor, connectionId)
        const url = await this.urlOf(connection.id)
        const target = await this.target(url)
        const key = this.requireSigning(actor.workspaceId)
        const sample = this.sampleOf(connection)
        const now = this.clock.now()
        const id = this.ids.next()
        const body = JSON.stringify({
            id,
            event: sample.id,
            workspace_id: actor.workspaceId,
            occurred_at: now.toISOString(),
            data: { test: true, ...sample.sample },
        })
        const timestamp = String(now.getTime())
        const result = await this.delivery.post({
            url: target,
            body,
            headers: {
                "x-nivo-event": sample.id,
                "x-nivo-delivery": id,
                "x-nivo-timestamp": timestamp,
                "x-nivo-signature": signDelivery(key, timestamp, body),
                "x-nivo-test": "1",
            },
        })
        if (result.status === null) {
            return {
                ok: false,
                status: null,
                error: result.failure === "timeout" ? "TIMEOUT" : "UNREACHABLE",
                durationMs: result.durationMs,
            }
        }
        const ok = result.status >= 200 && result.status < 300
        await this.connections.patch(actor.workspaceId, connection.id, {
            lastError: ok ? null : `HTTP ${result.status}`,
        })
        return { ok, status: result.status, error: ok ? null : "HTTP_STATUS", durationMs: result.durationMs }
    }

    /** Last wizard step: marks the connection live (events start flowing). */
    async finish(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.ownWebhook(actor, connectionId)
        await this.connections.patch(actor.workspaceId, connection.id, { status: "connected", lastError: null })
    }

    /** The event a test delivery sends: the first available event the connection picked (its declared sample data), else the first available one. */
    private sampleOf(connection: ConnectionRecord): WebhookEventOption {
        const available = installedWebhookEvents()
        const picked = eventsOf(connection.meta, idsOf(available))
        const first = available.find((option) => option.id === picked[0]) ?? available[0]
        if (first === undefined) throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.EventsEmpty })
        return first
    }

    private requireEvents(events: ReadonlyArray<string>): Array<string> {
        const picked = pickEvents(events, idsOf(installedWebhookEvents()))
        if (picked.length === 0) throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.EventsEmpty })
        return picked
    }

    private requireSigning(workspaceId: string): string {
        const shared = this.options.signingSecret
        if (shared === undefined) {
            throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.SigningUnavailable })
        }
        return workspaceSigningSecret(shared.reveal(), workspaceId)
    }

    private async target(raw: string): Promise<URL> {
        try {
            return await this.delivery.resolveTarget(raw, this.connections.publicOrigin() !== null)
        } catch (error) {
            if (error instanceof WebhookDeliveryError) {
                throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.UrlRefused, cause: error })
            }
            throw error
        }
    }

    private async ownWebhook(actor: ConnectionActor, id: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, id)
        if (connection.provider !== "webhook") {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        }
        return connection
    }

    private async urlOf(connectionId: string): Promise<string> {
        const secret = await this.connections.readSecret(connectionId)
        const read = secret === null ? null : parseJsonText(secret.plain)
        const parsed = read?.ok ? read.value : null
        const url = typeof parsed === "object" && parsed !== null && "url" in parsed ? parsed.url : null
        if (typeof url !== "string" || url === "") {
            throw new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl })
        }
        return url
    }
}

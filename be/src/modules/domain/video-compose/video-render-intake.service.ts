import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService, ConnectionsService } from "@modules/domain/connections"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type {
    RenderCompletion,
    RenderDoorDelivery,
    RenderDoorHeaders,
    RenderWebhook,
    VideoComposePort,
} from "./video-compose.contracts"
import { VideoComposeLogEvent } from "./video-compose.log-events"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import { isSoundCompletion, renderRowOf, renderTypeOf } from "./video-render-data.policy"
import { renderTriggerOf } from "./video-render.trigger"

/**
 * What one render webhook came to: a row kept (and its trigger fired), a repeat, a body reporting no finished render, a body that
 * cannot be read, a signature the provider's port refused, an account of another provider, or a provider that composes nothing.
 */
export type RenderIntakeOutcome =
    "kept" | "repeat" | "ignored" | "unreadable" | "unsigned" | "unknown_account" | "unknown_provider"

/** The account a render row belongs to, as the trigger's emit point takes it. */
export interface RenderOwner {
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The provider key. */
    readonly provider: string
}

/** The stored render row a completion is delivered for: its record type and its id. */
interface RenderRowRef {
    /** The row's record type. */
    readonly type: string
    /** The row's id. */
    readonly id: string
}

/** What reading a raw body as JSON came to. */
type BodyReading = { readonly ok: true; readonly body: unknown } | { readonly ok: false; readonly cause: unknown }

/** The raw body read as JSON. */
const bodyOf = (rawBody: Buffer): BodyReading => {
    try {
        return { ok: true, body: JSON.parse(rawBody.toString("utf8")) }
    } catch (cause) {
        return { ok: false, cause }
    }
}

/** One header's value (the first when sent twice), or undefined. */
const headerOf = (headers: RenderDoorHeaders, name: string | null): string | undefined => {
    if (name === null) return undefined
    const value = headers[name.toLowerCase()]
    return typeof value === "string" ? value : value?.[0]
}

@Injectable()
/**
 * THE RENDER DOOR'S INTAKE (generic, no provider named). The door proved the path's token first (`ScopedWebhookVerifier` with the
 * proof `VideoRenderProofsService` registered); here a provider that signs is held to its signature (the port's pure `proves`), the
 * body is mapped by the port's pure `completionOf`, and only a sound terminal completion is kept, as ONE `<provider>.render` row of the
 * account (the INBOX of the one event pipeline: the intake's insert-once on the render id is the dedupe, a repeat writes and delivers
 * nothing). The provider's render trigger then translates the row (pure) and the canonical event goes to the ONE delivery function in a
 * savepoint, and the row is completed; a delivery that throws leaves the row pending, logged, and the delivery acknowledged: the run's wait
 * falls back on its timeout and `statusOf`.
 */
export class VideoRenderIntakeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly registry: VideoComposeRegistryService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly connections: ConnectionsService,
        private readonly intake: AccountDataIntakeService,
        @Optional() private readonly triggers?: ProviderTriggersService,
    ) {}

    /** Takes one delivery of a provider's render webhook whose path token the door proved. */
    async accept(delivery: RenderDoorDelivery): Promise<RenderIntakeOutcome> {
        const outcome = await this.taken(delivery)
        this.logger.info(VideoComposeLogEvent.RenderReceived, {
            provider: delivery.provider,
            connectionId: delivery.connectionId,
            outcome,
        })
        return outcome
    }

    private async taken(delivery: RenderDoorDelivery): Promise<RenderIntakeOutcome> {
        const port = this.registry.of(delivery.provider)
        const webhook = port?.webhook ?? null
        if (port === undefined || webhook === null) return "unknown_provider"
        const { rawBody } = delivery
        if (rawBody === undefined) return "unreadable"
        if (!(await this.signed(port, webhook, delivery, rawBody))) return "unsigned"
        const reading = bodyOf(rawBody)
        if (!reading.ok) {
            this.logger.warn(VideoComposeLogEvent.RenderUnreadable, {
                provider: port.provider,
                cause: String(reading.cause),
            })
            return "unreadable"
        }
        const completion = port.completionOf(reading.body)
        if (completion === null) return "ignored"
        if (!isSoundCompletion(completion)) return "unreadable"
        return this.entityManager.transaction((tx) => this.kept(tx, delivery, completion))
    }

    /** Whether the delivery carries the provider's signature, for a provider that signs; true for one that does not. */
    private async signed(
        port: VideoComposePort,
        webhook: RenderWebhook,
        delivery: RenderDoorDelivery,
        rawBody: Buffer,
    ): Promise<boolean> {
        const header = webhook.signatureHeader
        if (header === null) return true
        const secrets = await this.connections.readSecret(delivery.connectionId)
        if (secrets === null) return false
        return port.proves(
            {
                rawBody,
                signature: headerOf(delivery.headers, header),
                timestamp: headerOf(delivery.headers, webhook.timestampHeader),
            },
            { plain: secrets.plain, webhookSecret: secrets.webhookSecret },
        )
    }

    /** Keeps the row once and fires its trigger, in `tx`. */
    private async kept(
        tx: EntityManager,
        delivery: RenderDoorDelivery,
        completion: RenderCompletion,
    ): Promise<RenderIntakeOutcome> {
        const { provider, connectionId } = delivery
        const account = await this.bindings.accountOf(connectionId, tx)
        if (account?.provider !== provider) return "unknown_account"
        const type = renderTypeOf(provider)
        const row = await this.intake.claim(tx, { connectionId, type, value: renderRowOf(provider, completion) })
        if (row === undefined) return "repeat"
        const value = renderRowOf(provider, completion)
        if (
            await this.fired(
                tx,
                { workspaceId: account.workspaceId, connectionId, provider },
                { type, id: row.id },
                value,
            )
        ) {
            const pending = await this.intake.lockPending(tx, type, connectionId, row.key)
            if (pending !== null) await this.intake.complete(tx, pending)
        }
        return "kept"
    }

    /** Delivers the new row's completion in a savepoint; false (logged) when it threw, so the row stays pending. */
    private async fired(
        tx: EntityManager,
        owner: RenderOwner,
        raw: RenderRowRef,
        value: ReturnType<typeof renderRowOf>,
    ): Promise<boolean> {
        const { triggers } = this
        if (triggers === undefined) return true
        const declaration = renderTriggerOf(owner.provider)
        const event = declaration.translate(value, { connectionId: owner.connectionId })
        if (event === null) return true
        try {
            await tx.transaction((inner) =>
                triggers.deliver(
                    {
                        workspaceId: owner.workspaceId,
                        declaration,
                        connectionId: owner.connectionId,
                        agentId: null,
                        events: [{ event, raw }],
                    },
                    inner,
                ),
            )
            return true
        } catch (cause) {
            this.logger.error(VideoComposeLogEvent.RenderFireFailed, cause, { ...owner })
            return false
        }
    }
}

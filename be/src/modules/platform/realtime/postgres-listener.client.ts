import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { listenOn } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CancelTimer, Timer } from "@modules/platform/retry"
import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"
import { NOTIFY_CHANNEL, PROBE_PREFIX, PROBE_TIMEOUT_MS, RECONNECT_DELAY_MS } from "./realtime.contracts"
import { InjectRealtimeTimer, InjectListenFactory, InjectPostgresRealtimeOptions } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import { listenUrlOf } from "./realtime.policy"
import type { PostgresRealtimeOptions } from "./realtime.options"
import type { ListenConnection, ListenFactory, ListenHandlers, NotificationListener } from "./postgres-listener.port"

@Injectable()
/**
 * The LISTEN connection of the Postgres hub. It listens on the hub channel and proves the connection carries notifications by
 * hearing a probe the hub sends from another session (a transaction pooler accepts LISTEN and delivers nothing). It hands every payload to the hub; when the
 * connection is lost it tells the hub, closes the dead client, opens a new one after a pause and tells the hub again. A first
 * connection that cannot open fails the boot; after that a failure is logged and retried until `stop`.
 */
export class PostgresListenerClient implements NotificationListener {
    private connection: ListenConnection | undefined
    private opening: ListenConnection | undefined
    private failed: { readonly connection: ListenConnection; readonly cause: unknown } | undefined
    private cancelRetry: CancelTimer = () => undefined
    private releaseProbe: () => void = () => undefined
    private stopped = false

    constructor(
        @InjectPostgresRealtimeOptions() private readonly options: PostgresRealtimeOptions,
        @InjectListenFactory() private readonly factory: ListenFactory,
        @InjectRealtimeTimer() private readonly timer: Timer,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Opens the connection and starts listening. */
    async start(handlers: ListenHandlers): Promise<void> {
        await this.open(handlers)
    }

    /** Stops reconnecting and closes the connection, the live one and one that is still opening. */
    async stop(): Promise<void> {
        this.stopped = true
        this.cancelRetry()
        this.releaseProbe()
        this.failed = undefined
        const connection = this.connection
        this.connection = undefined
        const opening = this.opening
        this.opening = undefined
        await connection?.end()
        await opening?.end()
    }

    /** Opens, listens and probes one connection; true when it is now the live connection, false when the listener was stopped meanwhile. */
    private async open(handlers: ListenHandlers): Promise<boolean> {
        const connection = this.factory.create(listenUrlOf(this.options).reveal())
        const probePayload = `${PROBE_PREFIX}${randomBytes(8).toString("hex")}`
        const heard: Array<() => void> = []
        const probed = new Promise<void>((resolve) => heard.push(resolve))
        connection.on("notification", (message) => {
            const payload = message.payload ?? ""
            if (payload === probePayload) heard.forEach((resolve) => resolve())
            else if (!payload.startsWith(PROBE_PREFIX)) handlers.notify(payload)
        })
        connection.on("error", (cause) => this.lost(connection, cause, handlers))
        connection.on("end", () => this.lost(connection, undefined, handlers))
        this.opening = connection
        try {
            await connection.connect()
            await listenOn(connection, NOTIFY_CHANNEL)
            await handlers.probe(probePayload)
            await this.heardWithin(probed)
            const failure = this.failureOf(connection)
            if (failure !== undefined) throw failure
        } catch (cause) {
            await this.endIfOwned(connection)
            throw this.failureOf(connection) ?? this.asRealtimeError(cause)
        }
        if (this.stopped) {
            await this.endIfOwned(connection)
            return false
        }
        this.opening = undefined
        this.connection = connection
        return true
    }

    /** Ends a connection that is still opening, unless `stop` already did. */
    private async endIfOwned(connection: ListenConnection): Promise<void> {
        if (this.opening !== connection) return
        this.opening = undefined
        await connection.end()
    }

    private asRealtimeError(cause: unknown): RealtimeError {
        return cause instanceof RealtimeError
            ? cause
            : new RealtimeError({ code: RealtimeErrorCode.ListenDropped, cause })
    }

    /** The loss `lost` recorded for a connection that is still opening, or undefined; consumed once. */
    private failureOf(connection: ListenConnection): RealtimeError | undefined {
        if (this.failed?.connection !== connection) return undefined
        const { cause } = this.failed
        this.failed = undefined
        return new RealtimeError({ code: RealtimeErrorCode.ListenDropped, cause })
    }

    /** Resolves when the probe arrived or the listener was stopped; rejects when the connection stayed silent for the probe window. */
    private heardWithin(probed: Promise<void>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const cancel = this.timer.schedule(() => {
                this.releaseProbe = () => undefined
                reject(new RealtimeError({ code: RealtimeErrorCode.ListenSilent }))
            }, PROBE_TIMEOUT_MS)
            this.releaseProbe = () => {
                this.releaseProbe = () => undefined
                cancel()
                resolve()
            }
            void probed.then(() => this.releaseProbe())
        })
    }

    private lost(connection: ListenConnection, cause: unknown, handlers: ListenHandlers): void {
        if (this.opening === connection) {
            this.failed ??= { connection, cause }
            return
        }
        if (this.connection !== connection) return
        this.connection = undefined
        this.logger.warn(RealtimeLogEvent.ListenLost, { cause: cause instanceof Error ? cause.message : "closed" })
        connection.end().catch((closeCause: unknown) =>
            this.logger.warn(RealtimeLogEvent.ListenLost, {
                cause: String(closeCause),
            }),
        )
        handlers.lost()
        this.retry(handlers)
    }

    private retry(handlers: ListenHandlers): void {
        this.cancelRetry = this.timer.schedule(() => void this.reopen(handlers), RECONNECT_DELAY_MS)
    }

    private async reopen(handlers: ListenHandlers): Promise<void> {
        if (this.stopped) return
        try {
            if (!(await this.open(handlers))) return
        } catch (cause) {
            if (this.stopped) return
            this.logger.error(RealtimeLogEvent.ListenFailed, cause)
            this.retry(handlers)
            return
        }
        handlers.resumed()
    }
}

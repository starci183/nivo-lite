import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"

/** The in-process hub: one api process, so tests and a single-replica dev run only. */
export interface MemoryRealtimeOptions {
    /** Selects the in-process hub. */
    readonly hub: "memory"
}

/** The shared hub of a lite deploy that runs N api replicas: Postgres LISTEN/NOTIFY plus the bounded `realtime_events` replay table. */
export interface PostgresRealtimeOptions {
    /** Selects the Postgres hub. */
    readonly hub: "postgres"
    /** The token of the shared entity manager of the connection that holds `realtime_events`. */
    readonly connection: InjectionToken
    /** The session-mode URL of that database: the hub LISTENs on it (never a transaction pooler). */
    readonly url: Secret
    /** A dedicated direct or session-mode URL for the LISTEN connection; absent, `url` serves both. */
    readonly listenUrl?: Secret | undefined
}

/** The Redis hub: a Redis Stream per topic for replay and Pub/Sub for the live push, shared by N replicas. */
export interface RedisRealtimeOptions {
    /** Selects the Redis hub. */
    readonly hub: "redis"
    /** The Redis URL (`redis://` or `rediss://`, with the password or ACL user when the server has one): a secret, never a literal. */
    readonly url: Secret
    /** The Redis database number. */
    readonly db: number
    /** The name the hub prefixes its Pub/Sub channel and stream keys with; Pub/Sub is server-wide, so apps sharing a server declare different ones. */
    readonly prefix: string
}

/** What the realtime capability needs: which hub the app runs, and for a shared hub the connection it uses. */
export type RealtimeOptions = MemoryRealtimeOptions | PostgresRealtimeOptions | RedisRealtimeOptions

/** The names of the hubs an app can run. */
export type RealtimeHubKind = RealtimeOptions["hub"]

/** What the app's `main.ts` reads for a Postgres hub: the hub, and the dedicated session-mode URL when `REALTIME_DB_URL` declares one. */
export interface PostgresRealtimeConfig extends Pick<PostgresRealtimeOptions, "hub"> {
    /** The direct or session-mode URL the hub LISTENs on; absent, the app root's primary database URL is used. */
    readonly listenUrl?: Secret | undefined
}

/** What the app's `main.ts` reads for realtime: the hub, the dedicated URL of a Postgres hub and the address of a Redis hub; the Postgres connection is the app root's choice. */
export type RealtimeConfig = MemoryRealtimeOptions | PostgresRealtimeConfig | RedisRealtimeOptions
